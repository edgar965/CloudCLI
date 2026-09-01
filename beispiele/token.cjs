/*
 * Legt den Anmelde-Token fuer die CloudCLI-Oberflaeche an, ohne Login-Fenster.
 *
 * Warum das ohne Zugangsdaten geht: Der Server signiert seine Tokens mit
 * `jwt_secret` aus `app_config` in derselben auth.db (server/modules/auth/
 * auth.middleware.ts). Wer diese Datei lesen darf, koennte sich ohnehin
 * anmelden - ein hier erzeugter Token gibt also nichts preis, was nicht schon
 * offen laege. Ein Passwort steht deshalb in KEINER Startdatei.
 *
 * Voraussetzung: einmal von Hand anmelden, damit es einen Benutzer und ein
 * jwt_secret gibt.
 *
 *   node beispiele/token.cjs           nur wenn noetig (fehlt oder laeuft ab)
 *   node beispiele/token.cjs --force   in jedem Fall neu
 *   node beispiele/token.cjs --print   Token auf stdout (fuer Startdateien)
 *
 * Umgebung:
 *   CLOUDCLI_QUELLE      Repo-Wurzel (Vorgabe: das Verzeichnis ueber diesem)
 *   DATABASE_PATH        auth.db (Vorgabe: ~/.cloudcli/auth.db)
 *   CLOUDCLI_TOKEN_TTL   Laufzeit; Vorgabe unbegrenzt, siehe unten
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');

const QUELLE = process.env.CLOUDCLI_QUELLE || path.resolve(__dirname, '..');
const TOKEN_DATEI = path.join(os.homedir(), '.cloudcli', 'ui-token.json');
const DB_DATEI = process.env.DATABASE_PATH || path.join(os.homedir(), '.cloudcli', 'auth.db');

/*
 * Laufzeit. Vorgabe ist UNBEGRENZT: der Token bekommt dann gar kein exp-Feld
 * und laeuft nie ab - jsonwebtoken laesst das zu, und die Middleware prueft
 * ohne exp nur die Signatur. Fuer einen Server auf 127.0.0.1 ist das die
 * richtige Wahl; wer ihn nach aussen oeffnet, setzt besser eine Frist.
 *
 *   CLOUDCLI_TOKEN_TTL=unbegrenzt   (auch: nie, never, 0, leer) - Vorgabe
 *   CLOUDCLI_TOKEN_TTL=365d         ein Jahr
 */
const TTL_ROH = process.env.CLOUDCLI_TOKEN_TTL;
const UNBEGRENZT = TTL_ROH === undefined
  || ['', '0', 'unbegrenzt', 'nie', 'never', 'none', 'infinite'].includes(String(TTL_ROH).trim().toLowerCase());
const LAUFZEIT = UNBEGRENZT ? null : String(TTL_ROH).trim();
/** Unter dieser Restlaufzeit wird vorsorglich neu ausgestellt. */
const MINDEST_REST_TAGE = 30;

function abbruch(text) {
  console.error(`FEHLER: ${text}`);
  process.exit(1);
}

const forkRequire = createRequire(path.join(QUELLE, 'package.json'));

let jwt;
let Database;
try {
  jwt = forkRequire('jsonwebtoken');
  Database = forkRequire('better-sqlite3');
} catch (error) {
  abbruch(`jsonwebtoken/better-sqlite3 nicht gefunden unter "${QUELLE}" - dort "npm install" laufen lassen. ${error.message}`);
}

/** Restlaufzeit in Tagen; Infinity ohne Ablauf, 0 wenn unbrauchbar. */
function restTage(token, secret) {
  try {
    const decoded = jwt.verify(token, secret);
    if (!decoded?.exp) return Infinity;
    return (decoded.exp * 1000 - Date.now()) / 86400000;
  } catch {
    return 0;
  }
}

function vorhandenerToken() {
  try {
    const parsed = JSON.parse(fs.readFileSync(TOKEN_DATEI, 'utf8'));
    return typeof parsed?.token === 'string' ? parsed.token : null;
  } catch {
    return null;
  }
}

if (!fs.existsSync(DB_DATEI)) {
  abbruch(`Datenbank nicht gefunden: ${DB_DATEI} - CloudCLI einmal starten und anmelden.`);
}

const db = new Database(DB_DATEI, { readonly: true });

const secret = process.env.JWT_SECRET
  || db.prepare("SELECT value FROM app_config WHERE key = 'jwt_secret'").get()?.value;
if (!secret) {
  abbruch('Kein jwt_secret in der Datenbank - einmal von Hand anmelden, dann klappt es.');
}

const user = db.prepare('SELECT id, username FROM users ORDER BY id LIMIT 1').get();
if (!user) {
  abbruch('Kein Benutzer in der Datenbank - einmal von Hand anmelden, dann klappt es.');
}

const nurAusgeben = process.argv.includes('--print');
const erzwingen = process.argv.includes('--force');

if (nurAusgeben) {
  const alt = vorhandenerToken();
  if (alt && restTage(alt, secret) >= MINDEST_REST_TAGE) {
    process.stdout.write(`${alt}\n`);
    process.exit(0);
  }
}

if (!erzwingen && !nurAusgeben) {
  const alt = vorhandenerToken();
  if (alt) {
    const rest = restTage(alt, secret);
    // Ein befristeter Token wird ersetzt, sobald unbegrenzt gewuenscht ist -
    // sonst bliebe die alte Frist ewig stehen.
    const passtZurEinstellung = UNBEGRENZT ? rest === Infinity : true;
    if (rest >= MINDEST_REST_TAGE && passtZurEinstellung) {
      console.log(
        rest === Infinity
          ? 'Token gilt unbegrenzt - unveraendert.'
          : `Token gilt noch ${Math.round(rest)} Tage - unveraendert.`,
      );
      process.exit(0);
    }
  }
}

// Dieselben Felder wie generateToken in auth.middleware.ts - andere Namen
// wuerden die Middleware zwar passieren, aber req.user leer lassen.
const token = jwt.sign(
  { userId: user.id, username: user.username },
  secret,
  LAUFZEIT ? { expiresIn: LAUFZEIT } : {},
);

// Nur fuer den Eigentuemer lesbar: in der Datei steht ein Bearer-Token, und
// mit der ueblichen Maske geschrieben koennte es auf einem geteilten Rechner
// jeder lesen und weiterverwenden. `mode` beim Schreiben greift nur beim
// Anlegen, eine vorhandene Datei wird deshalb ausdruecklich korrigiert.
fs.mkdirSync(path.dirname(TOKEN_DATEI), { recursive: true, mode: 0o700 });
fs.writeFileSync(
  TOKEN_DATEI,
  `${JSON.stringify({ token, username: user.username, updatedAt: new Date().toISOString() }, null, 2)}
`,
  { encoding: 'utf8', mode: 0o600 },
);
// Unter Windows folgenlos - dort erledigt das die ACL des Benutzerprofils.
try { fs.chmodSync(TOKEN_DATEI, 0o600); } catch { /* Dateisystem ohne Rechte */ }

if (nurAusgeben) {
  process.stdout.write(`${token}\n`);
} else {
  console.log(`Token fuer "${user.username}" ausgestellt (${LAUFZEIT || 'unbegrenzt'}): ${TOKEN_DATEI}`);
}
