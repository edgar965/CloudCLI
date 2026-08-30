---
description: Öffnet sofort einen Tab im laufenden Chrome (optional mit Adresse)
argument-hint: "[adresse]"
allowed-tools: mcp__chrome-tabs__tabs_context_mcp, mcp__chrome-tabs__tabs_create_mcp, mcp__chrome-tabs__navigate, mcp__chrome-tabs__list_connected_browsers
---

Tab öffnen, sofort. Kein Vorwort, keine Rückfrage, keine Zwischenmeldung.

1. `mcp__chrome-tabs__tabs_context_mcp` mit `createIfEmpty: true`.
2. `$ARGUMENTS` leer → `mcp__chrome-tabs__tabs_create_mcp`.
   Sonst → `mcp__chrome-tabs__navigate` mit `url: $ARGUMENTS` und der `tabId` des letzten
   Tabs aus Schritt 1 (ohne `tabId`: „No tab available").
3. Eine Zeile melden: Adresse und `tabId`. Den Seiteninhalt nicht lesen und nicht
   zusammenfassen.

Keine Antwort? Chrome läuft nicht oder die Erweiterung ist nicht verbunden —
`mcp__chrome-tabs__list_connected_browsers` zeigt es.
