---
description: Öffnet sofort einen Tab im laufenden Chrome (optional mit Adresse) — das Gegenstück zu @browser:newTab in VS Code
argument-hint: "[adresse]"
allowed-tools: mcp__chrome-tabs__tabs_context_mcp, mcp__chrome-tabs__tabs_create_mcp, mcp__chrome-tabs__navigate, mcp__chrome-tabs__list_connected_browsers
---

# /browser — Tab im echten Chrome öffnen

Öffne einen Browser-Tab über den MCP-Server **`chrome-tabs`** (das ist
`claude --claude-in-chrome-mcp`, dieselbe Anbindung, die auch die VS-Code-Erweiterung
benutzt). Es ist der **laufende Chrome** dieses Rechners mit seinen Anmeldungen — kein
zweiter, leerer Browser.

Argument: `$ARGUMENTS` — eine Adresse oder leer.

## Schritte

1. **Immer zuerst** `mcp__chrome-tabs__tabs_context_mcp` mit `createIfEmpty: true` aufrufen.
   Ohne diesen Schritt lehnen die anderen Werkzeuge ab. Die Antwort enthält `tabGroupId` und
   `availableTabs` mit ihren `tabId`s; öffnet gerade erst ein Fenster, kann der erste Aufruf
   einige Sekunden dauern.

2. **Ohne Argument:** `mcp__chrome-tabs__tabs_create_mcp` aufrufen — fertig, ein leerer Tab
   in der Gruppe.

3. **Mit Argument:** `mcp__chrome-tabs__navigate` mit `url: $ARGUMENTS` **und** der `tabId`
   des letzten Tabs aus Schritt 1 aufrufen. Ohne `tabId` antwortet das Werkzeug mit
   „No tab available". Ein Protokoll ist nicht nötig, `example.com` reicht.

4. In **einem Satz** melden, was offen ist: Adresse und `tabId`. Keine Zusammenfassung der
   Seite, kein Vorlesen des Inhalts — es sei denn, es wurde ausdrücklich gefragt.

## Wenn es klemmt

- **Keine Antwort / Zeitüberschreitung:** Chrome läuft nicht oder die Claude-Erweiterung ist
  nicht verbunden. `mcp__chrome-tabs__list_connected_browsers` zeigt, welche Browser hängen;
  gibt es keinen, Chrome starten und in der Erweiterung die Verbindung bestätigen.
- **Werkzeuge fehlen:** Der Server ist nicht eingetragen. Einmalig:
  `claude mcp add chrome-tabs --scope user -e USER_TYPE=external -- claude --claude-in-chrome-mcp`
- Der eingebaute Browser von CloudCLI (Reiter **Browser**) ist etwas anderes: ein eigener
  Playwright-Chromium auf dem Server, der erst installiert werden muss. Für „mach mir einen
  Tab auf" ist dieser Weg hier der kürzere.
