# CloudCLI — a fork of siteboon/claudecodeui

*[Deutsche Fassung](README.de.md)*

Web interface for Claude Code, OpenCode, Cursor and Codex. This fork
(`edgar965/CloudCLI`) runs on Windows with projects on drive `A:`, and opens one
window per project directory.

**➡️ Install, start and launchers: [HOWTO.md](HOWTO.md)**

The upstream documentation lives in [docs/README.md](docs/README.md).

## What is different here

| Change | Effect |
|---|---|
| Drive letter case | `a:\project` and `A:\project` are one project, not two |
| `WORKSPACES_ROOT=A:\` | A drive root is accepted as the workspace root |
| Route `/project/<path>` | The start address selects a project, and creates it when the directory is new |
| `?token=` and `?bypass=` | Login and "skip permissions" handed over by a launcher |
| `CLOUDCLI_INSTANCE_NAME` | Names the window, so several can run side by side |
| Models from the OpenCode config | A local Ollama, OpenRouter and the like show up in the model picker |
| Collapsible branches in the model picker | The 90+ OpenCode models can be folded away |

Four of these are open pull requests upstream:
[#1226](https://github.com/siteboon/claudecodeui/pull/1226),
[#1227](https://github.com/siteboon/claudecodeui/pull/1227),
[#1228](https://github.com/siteboon/claudecodeui/pull/1228),
[#1229](https://github.com/siteboon/claudecodeui/pull/1229).

## Quick start

```bash
git clone https://github.com/edgar965/CloudCLI.git
cd CloudCLI
npm install
npm run build
set SERVER_PORT=3010 && npm run server
```

Open `http://127.0.0.1:3010/` and create a user once. After that

```
beispiele\cloudcli-projekt.cmd "A:\project" --bypass
```

opens a window of its own for that directory, without a login and without
permission prompts. `beispiele\cloudcli-projekt.cmd help` lists every option.
