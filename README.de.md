# CloudCLI — Fork von siteboon/claudecodeui

*[English version](README.md)*

Weboberfläche für Claude Code, OpenCode, Cursor und Codex. Dieser Fork
(`edgar965/CloudCLI`) läuft unter Windows auf Laufwerk `A:` und startet je
Projektverzeichnis ein eigenes Fenster.

**➡️ Installation, Start und Startdateien: [HOWTO.de.md](HOWTO.de.md)**

Die Dokumentation des Ursprungsprojekts liegt unter
[docs/README.md](docs/README.md).

## Was hier anders ist

| Änderung | Wirkung |
|---|---|
| Laufwerksbuchstabe | `a:\projekt` und `A:\projekt` sind ein Projekt, nicht zwei |
| `WORKSPACES_ROOT=A:\` | Ein Laufwerk als Arbeitswurzel wird akzeptiert |
| Route `/project/<pfad>` | Startadresse wählt ein Projekt aus, und legt es an, wenn es unbekannt ist |
| `?token=` und `?bypass=` | Anmeldung und „Skip permissions" aus einer Startdatei |
| `CLOUDCLI_INSTANCE_NAME` | Name im Fenstertitel, für mehrere Fenster nebeneinander |
| Modelle aus der OpenCode-Konfiguration | Lokales Ollama, OpenRouter usw. erscheinen im Modell-Menü |
| Zuklappbare Äste im Modell-Menü | 90+ OpenCode-Modelle lassen sich einklappen |

Vier dieser Punkte liegen als Pull Request beim Ursprungsprojekt:
[#1226](https://github.com/siteboon/claudecodeui/pull/1226),
[#1227](https://github.com/siteboon/claudecodeui/pull/1227),
[#1228](https://github.com/siteboon/claudecodeui/pull/1228),
[#1229](https://github.com/siteboon/claudecodeui/pull/1229).

## Schnellstart

```bash
git clone https://github.com/edgar965/CloudCLI.git
cd CloudCLI
npm install
npm run build
set SERVER_PORT=3010 && npm run server
```

Dann `http://127.0.0.1:3010/` öffnen, einmal anmelden — danach startet

```
beispiele\cloudcli-projekt.cmd "A:\projekt" --bypass
```

ein eigenes Fenster für dieses Verzeichnis, ohne Login und ohne Rückfragen vor
Werkzeugaufrufen. `beispiele\cloudcli-projekt.cmd help` zeigt alle Optionen.
