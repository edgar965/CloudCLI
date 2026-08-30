---
description: Öffnet sofort einen Tab im laufenden Chrome (optional mit Adresse)
argument-hint: "[adresse]"
allowed-tools: mcp__chrome-tabs__tabs_context_mcp, mcp__chrome-tabs__navigate
---

In CloudCLI kommt dieser Text nie an: die Oberfläche fängt `/browser` ab und ruft
`POST /api/chrome-tabs/tab` auf, ohne Modell. Das hier gilt nur im Terminal.

`$ARGUMENTS` leer → `mcp__chrome-tabs__tabs_context_mcp` mit `createIfEmpty: true`.
Sonst zusätzlich `mcp__chrome-tabs__navigate` mit `url: $ARGUMENTS` und der `tabId` des
letzten Tabs daraus.

Keine Textantwort, keine Zusammenfassung.
