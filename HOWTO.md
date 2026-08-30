# Installing and using CloudCLI locally

*[Deutsche Fassung](HOWTO.de.md)*

A how-to for the fork **edgar965/CloudCLI** of
[siteboon/claudecodeui](https://github.com/siteboon/claudecodeui), written so that
another Claude instance can set it up, start it and diagnose it without asking
back. Everything here was tried on this machine; where a statement comes from a
measurement, the number is next to it.

**Contents**

1. [What this fork adds](#1-what-this-fork-adds)
2. [Requirements](#2-requirements)
3. [Installation](#3-installation)
4. [First start and login](#4-first-start-and-login)
5. [Opening a project directory](#5-opening-a-project-directory)
6. [Several windows at once](#6-several-windows-at-once)
7. [How the start works](#7-how-the-start-works)
8. [Models: where they come from](#8-models-where-they-come-from)
9. [Local models with Ollama](#9-local-models-with-ollama)
10. [Browser sessions](#10-browser-sessions)
11. [Environment variables](#11-environment-variables)
12. [Files and directories](#12-files-and-directories)
13. [Diagnosis recipes](#13-diagnosis-recipes)
14. [Known traps](#14-known-traps)
15. [Tests and development](#15-tests-and-development)

---

## 1. What this fork adds

| Change | Effect |
|---|---|
| Drive letter case | `a:\project` and `A:\project` are one project, not two |
| `WORKSPACES_ROOT=A:\` | A drive root is accepted as the workspace root (the prefix comparison used to fail on `A:\\`) |
| Route `/project/<path>` | The start address selects a project, and creates it when the directory is new |
| `?token=<jwt>` | Login handed over by a launcher, no login screen |
| `?bypass=1` | Turns off the prompts before tool calls |
| `CLOUDCLI_INSTANCE_NAME` | Names the window, so several can run side by side |
| Token without expiry | A token without `exp`; the middleware then only checks the signature |
| Models from the OpenCode config | A local Ollama, OpenRouter and the like show up in the model picker |
| Collapsible branches in the model picker | The 90+ OpenCode models can be folded away |

Four of these are open pull requests upstream:

| PR | Content |
|---|---|
| [#1226](https://github.com/siteboon/claudecodeui/pull/1226) | Drive letter case, a drive as the workspace root |
| [#1227](https://github.com/siteboon/claudecodeui/pull/1227) | Window name, open Local CloudCLI at startup |
| [#1228](https://github.com/siteboon/claudecodeui/pull/1228) | Models from the OpenCode config |
| [#1229](https://github.com/siteboon/claudecodeui/pull/1229) | Collapsible branches in the model picker |

Not submitted (too specific to this setup): the token and bypass handover in the
address, and the launchers.

---

## 2. Requirements

- **Node** — v24.12.0 with npm 11.6.2 here. The project declares no `engines`;
  Node 20 and up should have everything it uses (`fetch`, `node:test`).
- **Windows** for the launchers (`.cmd`). Server and interface run on Linux and
  macOS just as well.
- **At least one CLI agent** for CloudCLI to drive: `claude`, `opencode`,
  `cursor-agent` or `codex`. Without one there is nothing to operate.
- Optionally **[Ollama](https://ollama.com)** for local models (section 9).

## 3. Installation

```bash
git clone https://github.com/edgar965/CloudCLI.git
cd CloudCLI
npm install
npm run build          # client (vite) + server (tsc into dist-server/)
```

**The one rule that matters when building:** `npm run server` runs
**`dist-server/server/index.js`**, not the sources.

| Changed … | … then build with |
|---|---|
| `server/**` | `npm run build:server` |
| `src/**` (interface) | `npm run build:client` |
| both | `npm run build` |

Without the server build the old state keeps running, including files that were
deleted long ago (`tsc` does not clean `dist-server/`). For development there is
`npm run server:dev` (tsx, reads the sources directly) and `npm run dev` (server
and vite together).

## 4. First start and login

```bash
set SERVER_PORT=3010
npm run server
```

Open `http://127.0.0.1:3010/` and create a user **once, by hand**. That creates
`~/.cloudcli/auth.db`, the user and the `jwt_secret` — the token helper in the
next step needs both.

> **Always `127.0.0.1`, never `localhost`.** On Windows `localhost` resolves to
> `::1` first, and the failing IPv6 attempt costs time on every connection.
> Measured against Ollama: median 2,923 ms over `localhost`, 840 ms over
> `127.0.0.1`.

### Login without a login screen

```bash
node beispiele/token.cjs           # create a token when needed
node beispiele/token.cjs --print   # token on stdout, for launchers
node beispiele/token.cjs --force   # issue a new one regardless
```

The helper reads `jwt_secret` from the same `auth.db` the server signs its tokens
with (`server/modules/auth/auth.middleware.ts`) and stores the result in
`~/.cloudcli/ui-token.json`. **No launcher holds a password.** Anyone who can
read that database could log in anyway — the token gives away nothing that was
not already in the open.

The default is a token **without an expiry**: it carries no `exp` field at all,
and the middleware then only verifies the signature. For a server on `127.0.0.1`
that is the right call; anyone exposing it should set
`CLOUDCLI_TOKEN_TTL=365d`.

## 5. Opening a project directory

`beispiele/cloudcli-projekt.cmd` does everything in one call: start the server if
none is running, fetch a token, open the window, select the project.

```
cloudcli-projekt.cmd [<directory>] [options]

Without a directory the current one is used.

Options:
  --bypass          turn off the prompts before tool calls
                    (the "Skip permissions" setting): the agent edits
                    files and runs commands without asking.
  --name <name>     window name and profile (default: directory name).
                    The same name twice is the same profile - the second
                    window will not open.
  --port <port>     port of the server (default 3010).
  --browser         open in the default browser instead of a window.
  --nur-adresse     only print the start address, start nothing.
  help, --help      this help.

Environment:
  CLOUDCLI_QUELLE     repository root (default: the directory above this file)
  CLOUDCLI_TOKEN_TTL  token lifetime (default: unlimited)

Examples:
  cloudcli-projekt.cmd
  cloudcli-projekt.cmd "A:\project" --bypass
  cloudcli-projekt.cmd . --name work --port 3011
```

A file per project is two lines:

```cmd
@echo off
call "%~dp0..\beispiele\cloudcli-projekt.cmd" "A:\3DTools" %*
```

### `--bypass`

Sets `skipPermissions` in `claude-settings`, `opencode-settings` and
`cursor-tools-settings` — the same thing the settings offer under
*Agents → Permissions*. The server turns it into
`permissionMode: 'bypassPermissions'`
(`server/modules/providers/list/claude/claude-runtime.provider.js`). The agent
then edits files and runs commands without asking.

The setting **stays in the profile** until it is switched off in the settings — a
later start without `--bypass` does not take it back. If you want both, use two
profiles (`--name work` and `--name work-bypass`).

## 6. Several windows at once

Every window needs an **Electron profile of its own**: the single-instance lock
is keyed on `--user-data-dir` (`electron/main.js`, `requestSingleInstanceLock`).
Without one the second start quits immediately and only raises the first window.
The launcher therefore creates `%APPDATA%\CloudCLI-<name>`.

Unpackaged, the application is also called "Electron" rather than "CloudCLI" for
Electron — `app.setName` in `electron/main.js` comes too late, the profile path
is fixed by then. Without `--user-data-dir` the login (`cloud-account.json`),
`desktop-settings.json` and the window size land in `%APPDATA%\Electron`.

All windows share **one** server. The launcher starts it only when nothing is
listening on the port, and leaves it running when a window is closed — otherwise
one closed window would take the connection away from the others.

## 7. How the start works

1. The launcher encodes the path with `[uri]::EscapeDataString`, which also
   encodes `:` and `\` — they would be read as separators inside a route
   segment: `A:\3DTools` becomes `A%3A%5C3DTools`.
2. It fetches the token (`beispiele/token.cjs --print`) and builds the start
   address:
   `http://127.0.0.1:3010/project/A%3A%5C3DTools?token=<jwt>&bypass=1`
3. The path part goes to Electron as `CLOUDCLI_DESKTOP_START_PATH`, and
   `CLOUDCLI_DESKTOP_OPEN_LOCAL=1` makes the window open the local server
   straight away instead of the launcher screen (`electron/main.js`,
   `openLocalAtStartup`).
4. `src/startup/handover.js` reads `token` and `bypass` **before React mounts**
   and removes both from the address (`history.replaceState`).

   > Handing the token over through `localStorage` after the page had loaded was
   > too late: the interface reads the store on its first render, and the login
   > screen was already there.

5. The route `/project/:projectPath` selects the project as soon as the project
   list has arrived, and creates it through `POST /api/projects` when the
   directory is still unknown. The comparison also ignores case, because Windows
   treats `a:\work` and `A:\work` as the same directory.

The window then stays on the **"+ New Session"** page. That is deliberate: a
launcher is opened to start something new, and the provider and model choice
lives only on that page. Loading the last transcript covered it up — on a session
with 14,212 messages that was a measured 7.5 seconds of "Loading session
messages…" over exactly the screen the launcher was clicked for.

## 8. Models: where they come from

The model picker groups models **by provider**, and each provider has its own
source. For OpenCode there are two:

- **[models.dev](https://models.dev)** — the public catalog OpenCode ships with.
  211 providers, each model with `limit` (context window), `cost`, `tool_call`,
  `reasoning`, `modalities`. OpenCode builds its requests from those.
- **The user's own config**, `~/.config/opencode/opencode.json[c]` — for
  everything that cannot be in any catalog: a locally running Ollama, an
  OpenRouter key, an internal gateway.

**A local Ollama is not in models.dev** (only `ollama-cloud`, `lmstudio` and
similar — the hosted service, not your disk). No network catalog could do it
either: which models you have changes with every `ollama pull`.

That is why this fork reads the OpenCode config and appends its models to the
catalog (`server/modules/providers/list/opencode/opencode-config-models.ts`). It
reads `opencode.json`, `opencode.jsonc` **and** a file named by
`OPENCODE_CONFIG` — OpenCode merges them rather than picking one (measured
against `opencode models`).

**Why not simply ask Ollama what is installed?** Because that answers the wrong
question: what is on disk, not what OpenCode will run. Measured on an
installation with seven pulled models, four of them configured:

- `opencode models` lists exactly those four.
- `opencode run --model ollama/<not configured>` fails inside OpenCode, and
  **Ollama's log shows no request at all** — OpenCode never gets that far.

The first version of this feature asked Ollama and therefore offered three models
that could not start. The error in the interface reads `Unknown OpenCode error`.

## 9. Local models with Ollama

`~/.config/opencode/opencode.jsonc`:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "ollama": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Ollama (local)",
      "options": {
        // 127.0.0.1, not localhost - see section 4
        "baseURL": "http://127.0.0.1:11434/v1",
        "apiKey": "ollama"
      },
      "models": {
        "qwen3.8:27b": { "name": "qwen3.8:27b (16.5 GB)" },
        "gpt-oss:20b": { "name": "gpt-oss:20b (12.8 GB)" }
      }
    }
  }
}
```

**Add three lines after every `ollama pull`** — what is not in this list will not
start. The size in the name is pure convenience; `ollama list` has it.

Selecting one: **+ New Session → provider OpenCode → branch "Ollama (local)"**.
It cannot be done inside a running session — the menu above the input only offers
the models of the provider that session was started with.

A `"disabled": true` on a model has no effect, by the way: the schema only has
that field under `models.*.variants.*`, and `opencode models` still lists a model
marked that way.

## 10. Browser sessions

CloudCLI brings a browser of its own (the **Browser** tab) and registers itself as an MCP
server with every agent as soon as *Settings → Browser Use* is on. That is the counterpart
to `@browser:newTab` in VS Code.

**Only the agent creates a session.** There is no button and no REST route for it — the
agent calls the MCP tool `browser_create_session`, so asking for it in the chat is the way.
The browser tab lists running sessions and can stop and delete them; it cannot start one.

When nothing happens, it is usually one of these four:

| Check | How |
|---|---|
| Is the runtime there? | `GET /api/browser-use/status`: `playwrightInstalled` and `chromiumInstalled` must be `true`, otherwise install from the tab (or `POST /api/browser-use/runtime/install`) |
| Does the MCP entry carry the right port? | It is written from `SERVER_PORT` when Browser Use is switched on. With the server on 3010 and the entry on 3001 the MCP server talks into the void: switch Browser Use off and on again |
| Too many sessions? | Three per owner at most (`CLOUDCLI_BROWSER_USE_MAX_SESSIONS_PER_OWNER`); end the old ones in the tab |
| Session expired? | After 30 minutes idle (`CLOUDCLI_BROWSER_USE_SESSION_TTL_MS`) |

```bash
TOKEN=$(node beispiele/token.cjs --print)
BASE=http://127.0.0.1:3010/api/browser-use
curl -s -H "Authorization: Bearer $TOKEN" $BASE/status
curl -s -H "Authorization: Bearer $TOKEN" $BASE/sessions
curl -s -X POST -H "Authorization: Bearer $TOKEN" $BASE/sessions/<id>/stop
curl -s -X DELETE -H "Authorization: Bearer $TOKEN" $BASE/sessions/<id>
curl -s -X POST -H "Authorization: Bearer $TOKEN" $BASE/runtime/install
```

## 11. Environment variables

| Variable | Effect |
|---|---|
| `SERVER_PORT`, `HOST` | Address of the server (3010 here rather than 3001, see section 13) |
| `WORKSPACES_ROOT` | Root below which projects may live; `A:\` is allowed |
| `DATABASE_PATH` | Path of `auth.db` (default `~/.cloudcli/auth.db`) |
| `CLOUDCLI_QUELLE` | Repository root for the launchers |
| `CLOUDCLI_TOKEN_TTL` | Token lifetime; unlimited by default, `365d` sets a deadline |
| `CLOUDCLI_INSTANCE_NAME` | Name in the window title |
| `CLOUDCLI_DESKTOP_OPEN_LOCAL` | `1` = open the local server right at startup |
| `CLOUDCLI_DESKTOP_START_PATH` | Start path inside the interface, e.g. `/project/<encoded>` |
| `CLOUDCLI_DESKTOP_LOCAL_SERVER_URL` | Address of this server for the window |
| `CLOUDCLI_OPENCODE_CONFIG_MODELS` | `0` = do not read the OpenCode config for models |
| `OPENCODE_CONFIG` | Additional OpenCode config file |
| `ELECTRON_RUN_AS_NODE` | Must be **empty**, or no window starts (section 13) |

## 12. Files and directories

| Location | Contents |
|---|---|
| `~/.cloudcli/auth.db` | Users, `jwt_secret`, projects, sessions |
| `~/.cloudcli/ui-token.json` | Token for the interface, from `beispiele/token.cjs` |
| `%APPDATA%\CloudCLI-<name>` | Electron profile, one per window |
| `~/.config/opencode/opencode.jsonc` | OpenCode config (providers, models, permissions) |
| `~/.claude/` | Claude Code's own history, which CloudCLI shows in the sidebar |
| `dist/`, `dist-server/` | Build output — this is what the server runs |

## 13. Diagnosis recipes

**Is a server running, and which process is it?**

```powershell
$c = Get-NetTCPConnection -LocalPort 3010 -State Listen | Select-Object -First 1
Get-Process -Id $c.OwningProcess | Format-List Id, ProcessName, StartTime
```

`StartTime` tells you whether the process is older than the last build — then it
is running old code.

**Restart the server without a visible window:**

```powershell
$c = Get-NetTCPConnection -LocalPort 3010 -State Listen | Select-Object -First 1
if ($c) { Stop-Process -Id $c.OwningProcess -Force }
$env:SERVER_PORT="3010"; $env:HOST="127.0.0.1"; $env:WORKSPACES_ROOT="A:\"
Start-Process cmd.exe -ArgumentList '/c','npm run server' -WorkingDirectory 'A:\CloudCLI' -WindowStyle Hidden
```

**What does the model catalog actually serve?**

```bash
TOKEN=$(node beispiele/token.cjs --print)
curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:3010/api/providers/opencode/models
```

The models are under `data.models.OPTIONS`. If nothing from the OpenCode config
shows up there: `npm run build:server` was skipped.

**Did OpenCode actually talk to Ollama?**

```bash
grep -c "chat/completions" "$LOCALAPPDATA/Ollama/server.log"
```

`0` means OpenCode gave up before asking Ollama — the model is not in its config.
The `/api/tags` lines in the same file are only catalog reads.

**Which models does OpenCode itself know?**

```bash
opencode models | grep ollama
```

That is the authoritative answer — it takes ~5.3 s, which is why CloudCLI reads
the config file instead of calling it.

**Look at the server's project list** (which paths it knows, and how many
sessions each project has):

```bash
curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:3010/api/projects
```

## 14. Known traps

| Symptom | Cause and remedy |
|---|---|
| A server change has no effect | `npm run server` runs `dist-server/`; `npm run build:server` is missing |
| A deleted server file still runs | `tsc` does not clean `dist-server/`; delete the stale `.js` by hand |
| "Bundled backend did not become ready at 3001" | Port 3001 is taken. The availability check does not see a service bound to `0.0.0.0`. Use another port (3010 here) |
| Window will not start, `does not provide an export named 'safeStorage'` | `ELECTRON_RUN_AS_NODE=1` was inherited from the terminal (VS Code sets it). Put `set "ELECTRON_RUN_AS_NODE="` in the launcher |
| The second window does not appear | Same `--user-data-dir` as the first (single-instance lock) |
| Login screen despite a token | The token has to be in the **start** address as `?token=`; put into `localStorage` afterwards it is too late |
| `Unknown OpenCode error` on a local model | The model is missing from `opencode.jsonc` (section 9) |
| Everything takes ~2 s longer than expected | `localhost` instead of `127.0.0.1` |
| `%~dp0` points at the wrong place | In a `.cmd`, `shift` moves `%0` as well. Save the path into a variable **before** the argument loop |
| "The command *bypass* is … not found" | An `&` in an address is read as a command separator by cmd — even in quotes, once it sits inside a parenthesised block. Write it without parentheses and print it with `!VAR!` |

## 15. Tests and development

```bash
npm test           # server (node:test through tsx)
npm run test:client
npm run lint
```

Committing runs `lint-staged` with ESLint over the staged files; that can take
more than two minutes, and an interrupted run leaves a stash named
`lint-staged automatic backup`.

For work on the interface, `npm run dev` (vite on 5173, server on 3001/3010)
beats rebuilding after every change.
