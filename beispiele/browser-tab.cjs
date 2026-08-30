/*
 * Oeffnet sofort einen Browser-Tab - das Gegenstueck zu "@browser:newTab" in
 * Visual Studio Code.
 *
 *   node beispiele/browser-tab.cjs                     leerer Tab
 *   node beispiele/browser-tab.cjs github.com          Tab mit Adresse
 *   node beispiele/browser-tab.cjs http://127.0.0.1:3010/
 *
 * Wie das geht: Claude Code bringt den MCP-Server "Claude in Chrome" selbst
 * mit (`claude --claude-in-chrome-mcp`, stdio). Er redet mit der
 * Claude-Erweiterung im LAUFENDEN Chrome - kein Playwright, kein zweiter
 * Browser, und die Anmeldungen sind da, wo sie hingehoeren. Genau diesen
 * Server startet auch die VS-Code-Erweiterung.
 *
 * Voraussetzungen: Claude Code im PATH und die Chrome-Erweiterung verbunden.
 * Laeuft sie nicht, meldet der Server das - dann Chrome starten und in der
 * Erweiterung die Verbindung bestaetigen.
 */

const { spawn } = require('node:child_process');

const ZIEL = process.argv[2] || '';
// Der erste Aufruf dauert: Chrome muss die Verbindung zur Erweiterung
// bestaetigen. Gemessen bis zu 30 s, danach antwortet der Server in
// Sekundenbruchteilen.
const WARTEZEIT_MS = Number(process.env.CLOUDCLI_BROWSER_TIMEOUT_MS || 60000);

const server = spawn('claude', ['--claude-in-chrome-mcp'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  shell: true,
  env: { ...process.env, USER_TYPE: 'external' },
});

let puffer = '';
const wartende = new Map();

server.stdout.on('data', (brocken) => {
  puffer += brocken.toString();
  let umbruch = puffer.indexOf('\n');
  while (umbruch >= 0) {
    const zeile = puffer.slice(0, umbruch).trim();
    puffer = puffer.slice(umbruch + 1);
    if (zeile) {
      try {
        const nachricht = JSON.parse(zeile);
        const aufloesen = nachricht.id && wartende.get(nachricht.id);
        if (aufloesen) {
          wartende.delete(nachricht.id);
          aufloesen(nachricht);
        }
      } catch {
        // Zeilen, die kein JSON sind, gehoeren nicht uns.
      }
    }
    umbruch = puffer.indexOf('\n');
  }
});

server.stderr.on('data', (brocken) => {
  const text = brocken.toString().trim();
  if (text) {
    process.stderr.write(`${text}\n`);
  }
});

server.on('error', (fehler) => {
  console.error(`FEHLER: "claude" liess sich nicht starten - steht es im PATH? ${fehler.message}`);
  process.exit(1);
});

let naechsteId = 0;

function rufen(methode, parameter = {}) {
  naechsteId += 1;
  const id = naechsteId;

  return new Promise((aufloesen, ablehnen) => {
    const uhr = setTimeout(() => {
      wartende.delete(id);
      ablehnen(new Error(`Keine Antwort auf "${methode}" innerhalb von ${WARTEZEIT_MS} ms`));
    }, WARTEZEIT_MS);

    wartende.set(id, (nachricht) => {
      clearTimeout(uhr);
      if (nachricht.error) {
        ablehnen(new Error(nachricht.error.message || JSON.stringify(nachricht.error)));
        return;
      }
      aufloesen(nachricht.result);
    });

    server.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method: methode, params: parameter })}\n`);
  });
}

function melden(methode, parameter) {
  server.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: methode, params: parameter })}\n`);
}

/** Tab-Gruppe und Tabs aus einer Werkzeugantwort; die Antwort beginnt mit JSON. */
function gruppendaten(ergebnis) {
  const teile = Array.isArray(ergebnis?.content) ? ergebnis.content : [];
  for (const teil of teile) {
    if (typeof teil?.text !== 'string') continue;
    const start = teil.text.indexOf('{');
    if (start < 0) continue;
    try {
      const daten = JSON.parse(teil.text.slice(start, teil.text.lastIndexOf('}') + 1));
      return { tabGroupId: daten.tabGroupId, availableTabs: daten.availableTabs ?? [] };
    } catch {
      // Der Text ist nicht (nur) JSON - dann eben ohne IDs.
    }
  }
  return { tabGroupId: undefined, availableTabs: [] };
}

/** Der Textinhalt einer Werkzeugantwort, gekuerzt. */
function antworttext(ergebnis) {
  const teile = Array.isArray(ergebnis?.content) ? ergebnis.content : [];
  return teile
    .map((teil) => (typeof teil?.text === 'string' ? teil.text : ''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}

(async () => {
  await rufen('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'cloudcli-browser-tab', version: '1.0' },
  });
  melden('notifications/initialized');

  // Pflicht vor allen anderen Browser-Werkzeugen: die Tab-Gruppe holen.
  // createIfEmpty legt sie an, wenn es noch keine gibt - das ist der Moment,
  // in dem das Fenster aufgeht.
  //
  // Die VS-Code-Erweiterung macht fuer "@browser:newTab" NUR diesen einen
  // Aufruf (extension.js, createNewBrowserTab). Das reicht dort, weil jede
  // Sitzung ihre eigene Gruppe bekommt. Existiert die Gruppe schon, hat
  // createIfEmpty laut Schema "keine Wirkung" - dann braucht es
  // tabs_create_mcp fuer einen wirklich neuen Tab.
  const kontext = await rufen('tools/call', {
    name: 'tabs_context_mcp',
    arguments: { createIfEmpty: true },
  });
  let gruppe = gruppendaten(kontext);

  if (!ZIEL) {
    const vorher = new Set(gruppe.availableTabs.map((tab) => tab.tabId));
    await rufen('tools/call', { name: 'tabs_create_mcp', arguments: {} });
    // tabs_create_mcp meldet die neue ID nicht zurueck - der Kontext schon.
    gruppe = gruppendaten(await rufen('tools/call', { name: 'tabs_context_mcp', arguments: {} }));
    const neu = gruppe.availableTabs.find((tab) => !vorher.has(tab.tabId));
    console.log(`Leerer Tab offen${neu ? ` (tabId ${neu.tabId})` : ""}.`);
    server.kill();
    process.exit(0);
  }

  const ziel_tab = gruppe.availableTabs[gruppe.availableTabs.length - 1];
  const fahrt = await rufen('tools/call', {
    name: 'navigate',
    arguments: ziel_tab ? { url: ZIEL, tabId: ziel_tab.tabId } : { url: ZIEL },
  });
  const text = antworttext(fahrt);
  console.log(/error|no tab/i.test(text) ? text : `Geoeffnet: ${ZIEL}`);

  server.kill();
  process.exit(0);
})().catch((fehler) => {
  console.error(`FEHLER: ${fehler.message}`);
  server.kill();
  process.exit(1);
});
