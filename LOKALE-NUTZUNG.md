# CloudCLI lokal installieren und nutzen

Diese Datei beschreibt den Fork **edgar965/CloudCLI** von
[siteboon/claudecodeui](https://github.com/siteboon/claudecodeui) so, dass eine
andere Claude-Instanz ihn ohne Rückfragen aufsetzen und starten kann. Alles hier
ist auf diesem Rechner ausprobiert; wo eine Angabe aus einer Messung stammt,
steht die Zahl dabei.

---

## 1. Was dieser Fork zusätzlich kann

| Änderung | Wirkung |
|---|---|
| Laufwerksbuchstabe | `a:\projekt` und `A:\projekt` sind ein Projekt, nicht zwei |
| `WORKSPACES_ROOT=A:\` | Ein Laufwerk als Arbeitswurzel wird akzeptiert (vorher scheiterte der Präfixvergleich an `A:\\`) |
| Route `/project/<pfad>` | Startadresse wählt ein Projekt aus und legt es an, wenn es unbekannt ist |
| `?token=<jwt>` | Anmeldung aus einer Startdatei, kein Login-Fenster |
| `?bypass=1` | Schaltet die Rückfragen vor Werkzeugaufrufen ab |
| `CLOUDCLI_INSTANCE_NAME` | Name im Fenstertitel, für mehrere Fenster nebeneinander |
| Unbegrenztes Token | Token ohne `exp`; die Middleware prüft dann nur die Signatur |
| Modelle aus der OpenCode-Konfiguration | Lokales Ollama, OpenRouter usw. erscheinen im Modell-Menü |
| Zuklappbare Äste im Modell-Menü | 90+ OpenCode-Modelle lassen sich einklappen |

Die ersten beiden Punkte und die letzten beiden liegen als Pull Requests beim
Upstream: **#1226**, **#1227**, **#1228**, **#1229**.

---

## 2. Voraussetzungen

- **Node** – hier läuft v24.12.0, npm 11.6.2. Eine `engines`-Angabe hat das
  Projekt nicht; alles ab Node 20 sollte reichen (`fetch`, `node:test`).
- **Windows** – die Startdateien hier sind `.cmd`. Server und Oberfläche laufen
  genauso unter Linux/macOS.
- **Ein CLI-Agent**, den CloudCLI startet: `claude`, `opencode`, `cursor-agent`
  oder `codex`. Ohne einen davon gibt es nichts zu bedienen.
- Optional **Ollama** für lokale Modelle (siehe Abschnitt 7).

## 3. Installation

```bash
git clone https://github.com/edgar965/CloudCLI.git
cd CloudCLI
npm install
npm run build          # Client (vite) + Server (tsc nach dist-server/)
```

**Wichtig:** `npm run server` startet **`dist-server/server/index.js`**, nicht die
Quellen. Nach jeder Änderung an `server/**` muss `npm run build:server` laufen,
sonst läuft weiter der alte Stand — das kostet sonst leicht eine halbe Stunde
Fehlersuche. Für die Entwicklung gibt es `npm run server:dev` (tsx, liest die
Quellen direkt) und `npm run dev` (Server + Vite zusammen).

## 4. Erster Start und Anmeldung

```bash
set SERVER_PORT=3010
npm run server
```

Dann `http://127.0.0.1:3010/` öffnen und **einmal von Hand** einen Benutzer
anlegen. Dabei entstehen `~/.cloudcli/auth.db`, der Benutzer und das
`jwt_secret` — beides braucht der Token-Helfer im nächsten Schritt.

> **`127.0.0.1`, nicht `localhost`.** Unter Windows löst `localhost` zuerst nach
> `::1` auf; der fehlgeschlagene IPv6-Versuch kostet pro Verbindung Zeit
> (gemessen an Ollama: Median 2.923 ms gegenüber 840 ms).

### Anmeldung ohne Login-Fenster

```bash
node beispiele/token.cjs           # Token anlegen, wenn nötig
node beispiele/token.cjs --print   # Token auf stdout, für Startdateien
```

Der Helfer liest `jwt_secret` aus derselben `auth.db`, mit der der Server seine
Tokens signiert, und legt das Ergebnis in `~/.cloudcli/ui-token.json` ab. **In
keiner Startdatei steht ein Passwort.** Wer die Datenbank lesen darf, könnte sich
ohnehin anmelden — der Token gibt nichts preis, was nicht schon offenläge.

Vorgabe ist ein Token **ohne Ablauf** (`CLOUDCLI_TOKEN_TTL=365d` setzt eine
Frist). Für einen Server auf `127.0.0.1` ist das die richtige Wahl; wer ihn nach
außen öffnet, sollte eine Frist setzen.

## 5. Ein Projektverzeichnis öffnen

`beispiele/cloudcli-projekt.cmd` macht alles in einem Aufruf: Server starten,
falls er nicht läuft, Token besorgen, Fenster öffnen, Projekt auswählen.

```
cloudcli-projekt.cmd                          aktuelles Verzeichnis
cloudcli-projekt.cmd "A:\projekt"             dieses Verzeichnis
cloudcli-projekt.cmd "A:\projekt" --bypass    ohne Rückfragen
cloudcli-projekt.cmd . --name arbeit          eigener Fenstername
cloudcli-projekt.cmd . --browser              im Browser statt als Fenster
cloudcli-projekt.cmd . --port 3011            anderer Port
cloudcli-projekt.cmd . --nur-adresse          nur die Adresse ausgeben
cloudcli-projekt.cmd help                     alle Optionen
```

Die Adresse, die dabei entsteht, sieht so aus:

```
http://127.0.0.1:3010/project/A%3A%5C3DTools?token=<jwt>&bypass=1
```

`[uri]::EscapeDataString` kodiert `:` und `\`, die in einem Routenabschnitt sonst
als Trenner gelesen würden. `src/startup/handover.js` nimmt `token` und `bypass`
entgegen, **bevor** React startet, und räumt beide aus der Adresse.

### `--bypass`

Setzt `skipPermissions` in `claude-settings`, `opencode-settings` und
`cursor-tools-settings` — dasselbe, was in den Einstellungen unter
*Agents → Permissions* steht. Der Server macht daraus
`permissionMode: 'bypassPermissions'`
([claude-runtime.provider.js](server/modules/providers/list/claude/claude-runtime.provider.js)).
Der Agent ändert dann Dateien und führt Befehle aus, ohne zu fragen. Die
Einstellung bleibt im Profil gespeichert, bis sie in den Einstellungen wieder
abgeschaltet wird.

### Mehrere Fenster gleichzeitig

Jedes Fenster braucht ein **eigenes Electron-Profil**: Der Single-Instance-Lock
hängt am `--user-data-dir`. Ohne eigenes Profil beendet sich der zweite Start
sofort und holt nur das erste Fenster nach vorn. Die Beispieldatei legt deshalb
`%APPDATA%\CloudCLI-<Name>` an — zweimal derselbe Name ist zweimal dasselbe
Profil und öffnet kein zweites Fenster.

Ungepackt heißt die Anwendung für Electron außerdem „Electron", nicht „CloudCLI"
(`app.setName` in `electron/main.js` kommt zu spät). Ohne `--user-data-dir`
landen Anmeldung und Einstellungen in `%APPDATA%\Electron`.

## 6. Umgebungsvariablen

| Variable | Wirkung |
|---|---|
| `SERVER_PORT`, `HOST` | Adresse des Servers (hier 3010 statt 3001, siehe unten) |
| `WORKSPACES_ROOT` | Wurzel, unterhalb derer Projekte liegen dürfen; `A:\` ist erlaubt |
| `CLOUDCLI_QUELLE` | Repo-Wurzel für die Beispieldateien |
| `CLOUDCLI_TOKEN_TTL` | Laufzeit des Tokens, Vorgabe unbegrenzt |
| `CLOUDCLI_INSTANCE_NAME` | Name im Fenstertitel |
| `CLOUDCLI_DESKTOP_OPEN_LOCAL` | `1` = beim Start gleich den lokalen Server öffnen |
| `CLOUDCLI_DESKTOP_START_PATH` | Startpfad in der Oberfläche, z. B. `/project/<kodiert>` |
| `CLOUDCLI_DESKTOP_LOCAL_SERVER_URL` | Adresse dieses Servers fürs Fenster |
| `CLOUDCLI_OPENCODE_CONFIG_MODELS` | `0` = OpenCode-Konfiguration nicht nach Modellen lesen |
| `OPENCODE_CONFIG` | zusätzliche OpenCode-Konfiguration |

## 7. Lokale Modelle (Ollama)

CloudCLI selbst spricht nicht mit Ollama — **OpenCode** tut es. Und OpenCode
kennt nur Modelle, die es aus dem Katalog [models.dev](https://models.dev) oder
aus der eigenen Konfiguration hat. Ein lokales Ollama steht dort nicht (211
Anbieter, kein Eintrag für ein lokales Ollama), also muss es in
`~/.config/opencode/opencode.jsonc` deklariert werden:

```jsonc
{
  "provider": {
    "ollama": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Ollama (lokal)",
      "options": { "baseURL": "http://127.0.0.1:11434/v1", "apiKey": "ollama" },
      "models": {
        "qwen3.8:27b": { "name": "qwen3.8:27b (16,5 GB)" },
        "gpt-oss:20b": { "name": "gpt-oss:20b (12,8 GB)" }
      }
    }
  }
}
```

**Was nicht in dieser Liste steht, startet nicht.** Gemessen: `opencode run
--model ollama/<nicht konfiguriert>` bricht in OpenCode ab, und Ollama sieht
dabei keine einzige Anfrage. Nach jedem `ollama pull` also drei Zeilen ergänzen.

CloudCLI liest diese Datei und hängt ihre Modelle an den OpenCode-Katalog
([opencode-config-models.ts](server/modules/providers/list/opencode/opencode-config-models.ts)).
Gelesen werden `opencode.json`, `opencode.jsonc` und eine über `OPENCODE_CONFIG`
angegebene Datei — OpenCode führt sie zusammen, statt eine auszuwählen. Auswahl
in der Oberfläche: **+ New Session → Provider OpenCode → Ast „Ollama (local)"**.

## 8. Wenn etwas nicht geht

| Symptom | Ursache |
|---|---|
| Änderung am Server wirkt nicht | `npm run server` läuft aus `dist-server/`; `npm run build:server` fehlt |
| „Bundled backend did not become ready at 3001" | Port 3001 ist belegt (die geprüfte Erreichbarkeit sagt nichts über `0.0.0.0`-Binder); anderen Port nehmen, z. B. 3010 |
| Fenster startet nicht, `does not provide an export named 'safeStorage'` | `ELECTRON_RUN_AS_NODE=1` ist aus dem Terminal geerbt; in der Startdatei mit `set "ELECTRON_RUN_AS_NODE="` leeren |
| Zweites Fenster kommt nicht hoch | Gleiches `--user-data-dir` wie das erste (Single-Instance-Lock) |
| Login-Fenster trotz Token | Token kam zu spät: er muss als `?token=` in der **Start**adresse stehen, die Oberfläche liest den Speicher beim ersten Rendern |
| Modell aus Ollama meldet „Unknown OpenCode error" | Modell fehlt in `opencode.jsonc` (siehe Abschnitt 7) |
| Alles dauert ~2 s länger als erwartet | `localhost` statt `127.0.0.1` |

## 9. Tests

```bash
npm test           # Server (node:test über tsx)
npm run test:client
npm run lint
```
