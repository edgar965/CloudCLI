# CloudCLI lokal installieren und nutzen

*[English version](HOWTO.md)*

Howto für den Fork **edgar965/CloudCLI** von
[siteboon/claudecodeui](https://github.com/siteboon/claudecodeui), geschrieben so,
dass eine andere Claude-Instanz ihn ohne Rückfragen aufsetzen, starten und
diagnostizieren kann. Alles hier ist auf diesem Rechner ausprobiert; wo eine
Aussage aus einer Messung stammt, steht die Zahl dabei.

**Inhalt**

1. [Was dieser Fork zusätzlich kann](#1-was-dieser-fork-zusätzlich-kann)
2. [Voraussetzungen](#2-voraussetzungen)
3. [Installation](#3-installation)
4. [Erster Start und Anmeldung](#4-erster-start-und-anmeldung)
5. [Ein Projektverzeichnis öffnen](#5-ein-projektverzeichnis-öffnen)
6. [Mehrere Fenster gleichzeitig](#6-mehrere-fenster-gleichzeitig)
7. [Wie der Start technisch abläuft](#7-wie-der-start-technisch-abläuft)
8. [Modelle: woher sie kommen](#8-modelle-woher-sie-kommen)
9. [Lokale Modelle mit Ollama](#9-lokale-modelle-mit-ollama)
10. [Browser-Sitzungen](#10-browser-sitzungen)
11. [Umgebungsvariablen](#11-umgebungsvariablen)
12. [Dateien und Verzeichnisse](#12-dateien-und-verzeichnisse)
13. [Diagnose-Rezepte](#13-diagnose-rezepte)
14. [Bekannte Fallen](#14-bekannte-fallen)
15. [Tests und Entwicklung](#15-tests-und-entwicklung)

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

Vier davon liegen als Pull Request beim Ursprungsprojekt:

| PR | Inhalt |
|---|---|
| [#1226](https://github.com/siteboon/claudecodeui/pull/1226) | Laufwerksbuchstabe, Laufwerk als Arbeitswurzel |
| [#1227](https://github.com/siteboon/claudecodeui/pull/1227) | Fenstername, lokalen Server beim Start öffnen |
| [#1228](https://github.com/siteboon/claudecodeui/pull/1228) | Modelle aus der OpenCode-Konfiguration |
| [#1229](https://github.com/siteboon/claudecodeui/pull/1229) | Zuklappbare Äste im Modell-Menü |

Nicht eingereicht (zu sehr auf diese Umgebung zugeschnitten): Token- und
Bypass-Übergabe in der Adresse, die Startdateien.

---

## 2. Voraussetzungen

- **Node** — hier läuft v24.12.0 mit npm 11.6.2. Eine `engines`-Angabe hat das
  Projekt nicht; ab Node 20 sollte alles vorhanden sein (`fetch`, `node:test`).
- **Windows** für die Startdateien (`.cmd`). Server und Oberfläche laufen genauso
  unter Linux und macOS.
- **Mindestens ein CLI-Agent**, den CloudCLI startet: `claude`, `opencode`,
  `cursor-agent` oder `codex`. Ohne einen davon gibt es nichts zu bedienen.
- Optional **[Ollama](https://ollama.com)** für lokale Modelle (Abschnitt 9).

## 3. Installation

```bash
git clone https://github.com/edgar965/CloudCLI.git
cd CloudCLI
npm install
npm run build          # Client (vite) + Server (tsc nach dist-server/)
```

**Die wichtigste Regel beim Bauen:** `npm run server` startet
**`dist-server/server/index.js`**, nicht die Quellen.

| Geändert an … | … dann bauen mit |
|---|---|
| `server/**` | `npm run build:server` |
| `src/**` (Oberfläche) | `npm run build:client` |
| beidem | `npm run build` |

Ohne den Server-Build läuft weiter der alte Stand — inklusive Dateien, die
längst gelöscht sind (`tsc` räumt `dist-server/` nicht auf). Für die Entwicklung
gibt es `npm run server:dev` (tsx, liest die Quellen direkt) und `npm run dev`
(Server und Vite zusammen).

## 4. Erster Start und Anmeldung

```bash
set SERVER_PORT=3010
npm run server
```

Dann `http://127.0.0.1:3010/` öffnen und **einmal von Hand** einen Benutzer
anlegen. Dabei entstehen `~/.cloudcli/auth.db`, der Benutzer und das
`jwt_secret` — beides braucht der Token-Helfer im nächsten Schritt.

> **Immer `127.0.0.1`, nie `localhost`.** Unter Windows löst `localhost` zuerst
> nach `::1` auf; der fehlschlagende IPv6-Versuch kostet pro Verbindung Zeit.
> Gegen Ollama gemessen: Median 2.923 ms über `localhost`, 840 ms über
> `127.0.0.1`.

### Anmeldung ohne Login-Fenster

```bash
node beispiele/token.cjs           # Token anlegen, wenn nötig
node beispiele/token.cjs --print   # Token auf stdout, für Startdateien
node beispiele/token.cjs --force   # in jedem Fall neu ausstellen
```

Der Helfer liest `jwt_secret` aus derselben `auth.db`, mit der der Server seine
Tokens signiert (`server/modules/auth/auth.middleware.ts`), und legt das Ergebnis
in `~/.cloudcli/ui-token.json` ab. **In keiner Startdatei steht ein Passwort.**
Wer die Datenbank lesen darf, könnte sich ohnehin anmelden — der Token gibt
nichts preis, was nicht schon offenläge.

Vorgabe ist ein Token **ohne Ablauf**: Er bekommt gar kein `exp`-Feld, und die
Middleware prüft dann nur die Signatur. Für einen Server auf `127.0.0.1` ist das
die richtige Wahl; wer ihn nach außen öffnet, setzt besser
`CLOUDCLI_TOKEN_TTL=365d`.

## 5. Ein Projektverzeichnis öffnen

`beispiele/cloudcli-projekt.cmd` macht alles in einem Aufruf: Server starten,
falls keiner läuft, Token besorgen, Fenster öffnen, Projekt auswählen.

```
cloudcli-projekt.cmd [<verzeichnis>] [Optionen]

Ohne Verzeichnis wird das aktuelle genommen.

Optionen:
  --bypass          Rückfragen vor Werkzeugaufrufen abschalten
                    (wie "Skip permissions" in den Einstellungen):
                    der Agent ändert Dateien und führt Befehle aus,
                    ohne zu fragen.
  --name <name>     Fenstername und Profil (Vorgabe: Verzeichnisname).
                    Zweimal derselbe Name heißt dasselbe Profil - das
                    zweite Fenster geht dann nicht auf.
  --port <port>     Port des Servers (Vorgabe 3010).
  --browser         im Standardbrowser öffnen statt als Fenster.
  --nur-adresse     nur die Startadresse ausgeben, nichts starten.
  help, --help      diese Hilfe.

Umgebung:
  CLOUDCLI_QUELLE     Repo-Wurzel (Vorgabe: Verzeichnis über dieser Datei)
  CLOUDCLI_TOKEN_TTL  Laufzeit des Tokens (Vorgabe: unbegrenzt)

Beispiele:
  cloudcli-projekt.cmd
  cloudcli-projekt.cmd "A:\projekt" --bypass
  cloudcli-projekt.cmd . --name arbeit --port 3011
```

Eine Datei je Projekt anzulegen ist ein Zweizeiler:

```cmd
@echo off
call "%~dp0..\beispiele\cloudcli-projekt.cmd" "A:\3DTools" %*
```

### `--bypass`

Setzt `skipPermissions` in `claude-settings`, `opencode-settings` und
`cursor-tools-settings` — dasselbe, was in den Einstellungen unter
*Agents → Permissions* steht. Der Server macht daraus
`permissionMode: 'bypassPermissions'`
(`server/modules/providers/list/claude/claude-runtime.provider.js`). Der Agent
ändert danach Dateien und führt Befehle aus, ohne zu fragen.

Die Einstellung bleibt **im Profil gespeichert**, bis sie in den Einstellungen
wieder abgeschaltet wird — ein späterer Start ohne `--bypass` nimmt sie nicht
zurück. Wer beides will, nimmt zwei Profile (`--name arbeit` und
`--name arbeit-bypass`).

## 6. Mehrere Fenster gleichzeitig

Jedes Fenster braucht ein **eigenes Electron-Profil**: Der Single-Instance-Lock
hängt am `--user-data-dir` (`electron/main.js`, `requestSingleInstanceLock`).
Ohne eigenes Profil beendet sich der zweite Start sofort und holt nur das erste
Fenster nach vorn. Die Beispieldatei legt deshalb `%APPDATA%\CloudCLI-<Name>` an.

Ungepackt heißt die Anwendung für Electron außerdem „Electron", nicht „CloudCLI"
— `app.setName` in `electron/main.js` kommt zu spät, der Profilpfad steht dann
schon fest. Ohne `--user-data-dir` landen Anmeldung (`cloud-account.json`),
`desktop-settings.json` und die Fenstergröße in `%APPDATA%\Electron`.

Alle Fenster teilen sich **einen** Server. Die Beispieldatei startet ihn nur,
wenn auf dem Port keiner lauscht, und lässt ihn beim Schließen des Fensters
laufen — sonst nähme ein geschlossenes Fenster den anderen die Verbindung weg.

## 7. Wie der Start technisch abläuft

1. Die Startdatei kodiert den Pfad mit `[uri]::EscapeDataString` — das kodiert
   auch `:` und `\`, die in einem Routenabschnitt sonst als Trenner gelesen
   würden: `A:\3DTools` wird zu `A%3A%5C3DTools`.
2. Sie holt den Token (`beispiele/token.cjs --print`) und baut daraus die
   Startadresse:
   `http://127.0.0.1:3010/project/A%3A%5C3DTools?token=<jwt>&bypass=1`
3. Der Pfadteil geht als `CLOUDCLI_DESKTOP_START_PATH` an Electron,
   `CLOUDCLI_DESKTOP_OPEN_LOCAL=1` sorgt dafür, dass das Fenster gleich den
   lokalen Server öffnet statt des Launchers (`electron/main.js`,
   `openLocalAtStartup`).
4. `src/startup/handover.js` liest `token` und `bypass` **bevor React startet**
   und räumt beide aus der Adresse (`history.replaceState`).

   > Den Token erst nach dem Laden per `localStorage` nachzureichen war zu spät:
   > Die Oberfläche liest den Speicher beim ersten Rendern, das Login-Fenster
   > stand da schon.

5. Die Route `/project/:projectPath` wählt das Projekt aus, sobald die
   Projektliste da ist, und legt es über `POST /api/projects` an, wenn das
   Verzeichnis noch unbekannt ist. Der Vergleich ist zusätzlich
   groß-/kleinschreibungsunabhängig, weil Windows `a:\work` und `A:\work` als
   dasselbe Verzeichnis behandelt.

Das Fenster bleibt danach auf der Seite **„+ New Session"** stehen. Das ist
Absicht: Eine Startdatei öffnet man, um etwas Neues anzufangen, und die
Provider- und Modellauswahl steht nur auf dieser Seite. Ein automatisch
geladener letzter Verlauf verdeckte sie — bei einer Sitzung mit 14.212
Nachrichten gemessene 7,5 Sekunden „Loading session messages…" über genau dem
Bildschirm, für den man die Datei angeklickt hat.

## 8. Modelle: woher sie kommen

Im Modell-Menü stehen die Modelle **je Provider**, und jeder Provider hat seine
eigene Quelle. Für OpenCode sind es zwei:

- **[models.dev](https://models.dev)** — der öffentliche Katalog, den OpenCode
  mitbringt. 211 Anbieter, je Modell mit `limit` (Kontextfenster), `cost`,
  `tool_call`, `reasoning`, `modalities`. Daraus baut OpenCode seine Anfragen.
- **Die eigene Konfiguration** `~/.config/opencode/opencode.json[c]` — für alles,
  was in keinem Katalog stehen kann: ein lokal laufendes Ollama, ein
  OpenRouter-Schlüssel, ein firmeninternes Gateway.

**Ein lokales Ollama ist in models.dev nicht enthalten** (nur `ollama-cloud`,
`lmstudio` und Ähnliches — der gehostete Dienst, nicht deine Platte). Das kann
auch kein Netz-Katalog leisten: Welche Modelle bei dir liegen, ändert sich mit
jedem `ollama pull`.

Deshalb liest dieser Fork die OpenCode-Konfiguration und hängt ihre Modelle an
den Katalog
(`server/modules/providers/list/opencode/opencode-config-models.ts`). Gelesen
werden `opencode.json`, `opencode.jsonc` **und** eine über `OPENCODE_CONFIG`
angegebene Datei — OpenCode führt sie zusammen, statt eine auszuwählen (gemessen
an `opencode models`).

**Warum nicht einfach Ollama fragen, was installiert ist?** Weil das die falsche
Frage ist: Sie beantwortet, was auf der Platte liegt, nicht was OpenCode startet.
Gemessen auf einer Installation mit sieben geladenen Modellen, vier davon
konfiguriert:

- `opencode models` listet genau die vier.
- `opencode run --model ollama/<nicht konfiguriert>` bricht in OpenCode ab, und
  **Ollamas Log zeigt dabei keine einzige Anfrage** — OpenCode kommt gar nicht so
  weit.

Die erste Fassung dieses Features fragte Ollama und bot deshalb drei Modelle an,
die nicht starten konnten. Der Fehler in der Oberfläche lautet dann
`Unknown OpenCode error`.

## 9. Lokale Modelle mit Ollama

`~/.config/opencode/opencode.jsonc`:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "ollama": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Ollama (lokal)",
      "options": {
        // 127.0.0.1, nicht localhost - siehe Abschnitt 4
        "baseURL": "http://127.0.0.1:11434/v1",
        "apiKey": "ollama"
      },
      "models": {
        "qwen3.8:27b": { "name": "qwen3.8:27b (16,5 GB)" },
        "gpt-oss:20b": { "name": "gpt-oss:20b (12,8 GB)" }
      }
    }
  }
}
```

**Nach jedem `ollama pull` drei Zeilen ergänzen** — was nicht in dieser Liste
steht, startet nicht. Die Größe im Namen ist reine Bequemlichkeit; sie steht in
`ollama list`.

Auswählen in der Oberfläche: **+ New Session → Provider OpenCode → Ast
„Ollama (local)"**. In einer laufenden Sitzung geht es nicht — das Menü über dem
Eingabefeld zeigt nur die Modelle des Providers, mit dem die Sitzung gestartet
wurde.

Ein `"disabled": true` am Modell hat übrigens keine Wirkung: Das Feld gibt es im
Schema nur unter `models.*.variants.*`, und `opencode models` listet ein so
markiertes Modell weiterhin.

## 10. Browser-Sitzungen

CloudCLI bringt einen eigenen Browser mit (Reiter **Browser**) und meldet sich als
MCP-Server bei allen Agenten an, sobald *Settings → Browser Use* eingeschaltet ist.
Das ist das Gegenstück zu `@browser:newTab` in VS Code.

**Eine Sitzung entsteht nur durch den Agenten.** Es gibt dafür weder einen Knopf noch
eine REST-Route — der Agent ruft das MCP-Werkzeug `browser_create_session` auf. Im Chat
also schlicht darum bitten. Der Browser-Reiter zeigt die laufenden Sitzungen und kann sie
stoppen und löschen; erzeugen kann er keine.

Wenn nichts passiert, sind es meist diese vier:

| Prüfen | Wie |
|---|---|
| Ist die Laufzeit da? | `GET /api/browser-use/status`: `playwrightInstalled` und `chromiumInstalled` müssen `true` sein, sonst im Reiter installieren (oder `POST /api/browser-use/runtime/install`) |
| Stimmt der Port im MCP-Eintrag? | Er wird beim Einschalten aus `SERVER_PORT` geschrieben. Läuft der Server auf 3010, der Eintrag aber auf 3001, redet der MCP-Server ins Leere: Browser Use einmal aus- und wieder einschalten |
| Zu viele Sitzungen? | Höchstens drei je Besitzer (`CLOUDCLI_BROWSER_USE_MAX_SESSIONS_PER_OWNER`); alte im Reiter beenden |
| Sitzung abgelaufen? | Nach 30 Minuten ohne Nutzung (`CLOUDCLI_BROWSER_USE_SESSION_TTL_MS`) |

```bash
TOKEN=$(node beispiele/token.cjs --print)
BASE=http://127.0.0.1:3010/api/browser-use
curl -s -H "Authorization: Bearer $TOKEN" $BASE/status
curl -s -H "Authorization: Bearer $TOKEN" $BASE/sessions
curl -s -X POST -H "Authorization: Bearer $TOKEN" $BASE/sessions/<id>/stop
curl -s -X DELETE -H "Authorization: Bearer $TOKEN" $BASE/sessions/<id>
curl -s -X POST -H "Authorization: Bearer $TOKEN" $BASE/runtime/install
```


### Der kürzere Weg: der Chrome, der schon läuft

Visual Studio Code öffnet mit `@browser:newTab` sofort einen Tab, ohne dass irgendetwas
installiert werden müsste. Das liegt daran, dass die Erweiterung gar keinen Browser startet:
Sie ruft **Claude Code selbst** als MCP-Server auf —
`claude --claude-in-chrome-mcp` über stdio — und der redet mit der Claude-Erweiterung im
laufenden Chrome. Angemeldet ist man dort, wo man ohnehin angemeldet ist.

Derselbe Server lässt sich in CloudCLI eintragen. Einmalig:

```bash
claude mcp add chrome-tabs --scope user -e USER_TYPE=external -- claude --claude-in-chrome-mcp
claude mcp list        # chrome-tabs: ... - Connected
```

(Der Name `claude-in-chrome` ist reserviert, deshalb `chrome-tabs`.) Danach hat der Agent
22 Werkzeuge: `navigate`, `tabs_create_mcp`, `read_page`, `find`, `form_input`,
`read_console_messages`, `read_network_requests` und weitere.

Dazu ein Slash-Kommando, das CloudCLI in jedem Projekt anbietet — `beispiele/browser.md`
nach `~/.claude/commands/browser.md` kopieren, dann:

```
/browser                 leerer Tab
/browser example.com     Tab mit Adresse
```

Ohne Oberfläche geht es auch direkt:

```bash
node beispiele/browser-tab.cjs example.com
```

Beim allerersten Aufruf dauert es, bis Chrome die Verbindung bestätigt hat; danach
antwortet der Server sofort. Meldet er nichts, läuft Chrome nicht oder die Erweiterung
ist nicht verbunden — `list_connected_browsers` zeigt es.

## 11. Umgebungsvariablen

| Variable | Wirkung |
|---|---|
| `SERVER_PORT`, `HOST` | Adresse des Servers (hier 3010 statt 3001, siehe Abschnitt 13) |
| `WORKSPACES_ROOT` | Wurzel, unterhalb derer Projekte liegen dürfen; `A:\` ist erlaubt |
| `DATABASE_PATH` | Pfad der `auth.db` (Vorgabe `~/.cloudcli/auth.db`) |
| `CLOUDCLI_QUELLE` | Repo-Wurzel für die Beispieldateien |
| `CLOUDCLI_TOKEN_TTL` | Laufzeit des Tokens; Vorgabe unbegrenzt, `365d` setzt eine Frist |
| `CLOUDCLI_INSTANCE_NAME` | Name im Fenstertitel |
| `CLOUDCLI_DESKTOP_OPEN_LOCAL` | `1` = beim Start gleich den lokalen Server öffnen |
| `CLOUDCLI_DESKTOP_START_PATH` | Startpfad in der Oberfläche, z. B. `/project/<kodiert>` |
| `CLOUDCLI_DESKTOP_LOCAL_SERVER_URL` | Adresse dieses Servers fürs Fenster |
| `CLOUDCLI_OPENCODE_CONFIG_MODELS` | `0` = OpenCode-Konfiguration nicht nach Modellen lesen |
| `OPENCODE_CONFIG` | zusätzliche OpenCode-Konfiguration |
| `ELECTRON_RUN_AS_NODE` | muss **leer** sein, sonst startet kein Fenster (Abschnitt 13) |

## 12. Dateien und Verzeichnisse

| Ort | Inhalt |
|---|---|
| `~/.cloudcli/auth.db` | Benutzer, `jwt_secret`, Projekte, Sitzungen |
| `~/.cloudcli/ui-token.json` | Token für die Oberfläche, von `beispiele/token.cjs` |
| `%APPDATA%\CloudCLI-<Name>` | Electron-Profil je Fenster |
| `~/.config/opencode/opencode.jsonc` | OpenCode-Konfiguration (Provider, Modelle, Rechte) |
| `~/.claude/` | Verlauf von Claude Code, den CloudCLI in der Seitenleiste zeigt |
| `dist/`, `dist-server/` | Bauergebnisse — von dort läuft der Server |

## 13. Diagnose-Rezepte

**Läuft ein Server, und welcher Prozess ist es?**

```powershell
$c = Get-NetTCPConnection -LocalPort 3010 -State Listen | Select-Object -First 1
Get-Process -Id $c.OwningProcess | Format-List Id, ProcessName, StartTime
```

Die `StartTime` verrät, ob der Prozess älter ist als der letzte Build — dann
läuft alter Code.

**Server neu starten (ohne sichtbares Fenster):**

```powershell
$c = Get-NetTCPConnection -LocalPort 3010 -State Listen | Select-Object -First 1
if ($c) { Stop-Process -Id $c.OwningProcess -Force }
$env:SERVER_PORT="3010"; $env:HOST="127.0.0.1"; $env:WORKSPACES_ROOT="A:\"
Start-Process cmd.exe -ArgumentList '/c','npm run server' -WorkingDirectory 'A:\CloudCLI' -WindowStyle Hidden
```

**Was liefert der Modellkatalog wirklich?**

```bash
TOKEN=$(node beispiele/token.cjs --print)
curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:3010/api/providers/opencode/models
```

Die Modelle stehen unter `data.models.OPTIONS`. Wenn dort nichts aus der
OpenCode-Konfiguration auftaucht: `npm run build:server` vergessen.

**Hat OpenCode wirklich mit Ollama gesprochen?**

```bash
grep -c "chat/completions" "$LOCALAPPDATA/Ollama/server.log"
```

`0` heißt: OpenCode hat abgebrochen, bevor es Ollama gefragt hat — das Modell
steht nicht in seiner Konfiguration. `/api/tags` in derselben Datei sind nur
Katalogabfragen.

**Welche Modelle kennt OpenCode selbst?**

```bash
opencode models | grep ollama
```

Das ist die verbindliche Antwort — sie dauert allerdings ~5,3 Sekunden, deshalb
liest CloudCLI die Konfigurationsdatei statt dieses Kommando aufzurufen.

**Projektliste des Servers ansehen** (zeigt, welche Pfade er kennt und wie viele
Sitzungen er je Projekt hat):

```bash
curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:3010/api/projects
```

## 14. Bekannte Fallen

| Symptom | Ursache und Abhilfe |
|---|---|
| Änderung am Server wirkt nicht | `npm run server` läuft aus `dist-server/`; `npm run build:server` fehlt |
| Gelöschte Serverdatei wirkt noch | `tsc` räumt `dist-server/` nicht auf; die alte `.js` von Hand löschen |
| „Bundled backend did not become ready at 3001" | Port 3001 ist belegt. Die Erreichbarkeitsprüfung erkennt einen Dienst nicht, der auf `0.0.0.0` lauscht. Anderen Port nehmen (hier 3010) |
| Fenster startet nicht, `does not provide an export named 'safeStorage'` | `ELECTRON_RUN_AS_NODE=1` ist aus dem Terminal geerbt (VS Code setzt es). In der Startdatei `set "ELECTRON_RUN_AS_NODE="` |
| Zweites Fenster kommt nicht hoch | Gleiches `--user-data-dir` wie das erste (Single-Instance-Lock) |
| Login-Fenster trotz Token | Der Token muss als `?token=` in der **Start**adresse stehen; nachträglich in `localStorage` gelegt ist er zu spät |
| `Unknown OpenCode error` bei einem lokalen Modell | Modell fehlt in `opencode.jsonc` (Abschnitt 9) |
| Alles dauert ~2 s länger als erwartet | `localhost` statt `127.0.0.1` |
| `%~dp0` zeigt ins Falsche | In einer `.cmd` verschiebt `shift` auch `%0`. Den Pfad **vor** der Argumentschleife in eine Variable sichern |
| „Der Befehl *bypass* ist … nicht gefunden" | Ein `&` in einer Adresse wird von cmd als Befehlstrenner gelesen — auch in Anführungszeichen, sobald es in einem Klammerblock steht. Ohne Klammern schreiben und mit `!VAR!` ausgeben |

## 15. Tests und Entwicklung

```bash
npm test           # Server (node:test über tsx)
npm run test:client
npm run lint
```

Beim Committen läuft `lint-staged` mit ESLint über die geänderten Dateien; das
kann über zwei Minuten dauern, ein abgebrochener Lauf hinterlässt einen Stash
namens `lint-staged automatic backup`.

Für Änderungen an der Oberfläche lohnt `npm run dev` (Vite auf 5173, Server auf
3001/3010) statt nach jeder Änderung neu zu bauen.
