import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

/**
 * The desktop app's own log, written to a file.
 *
 * A packaged window has nowhere else to put it: the renderer's console lives in
 * DevTools, which nobody has open, and the main process writes to a stdout no
 * one is attached to - a window started from a launcher has no console at all.
 * So when the app misbehaves there is nothing to read afterwards, and the only
 * evidence left is whatever the CLI happened to write into its own transcript.
 *
 * The file lives in the profile (`userData`), not in the project directory:
 * every desktop window runs with its own `--user-data-dir`, so several windows
 * cannot end up interleaving their lines in one file.
 */
export class LogFile {
  constructor({ dir = null, name = 'desktop', maxBytes = 5 * 1024 * 1024 } = {}) {
    this.dir = dir;
    this.name = name;
    this.maxBytes = maxBytes;
    this.file = null;
    this.broken = false;
  }

  /**
   * Resolves the path on first use, not in the constructor: `userData` is only
   * meaningful once Electron has applied `--user-data-dir`.
   */
  ensureFile() {
    if (this.file || this.broken) return this.file;
    try {
      const dir = this.dir || path.join(app.getPath('userData'), 'logs');
      fs.mkdirSync(dir, { recursive: true });
      this.file = path.join(dir, `${this.name}.log`);
    } catch {
      // A profile we cannot write to must not take the app down with it.
      this.broken = true;
    }
    return this.file;
  }

  /** Keeps one predecessor, so the file cannot grow without bound. */
  rotateIfNeeded() {
    try {
      const size = fs.statSync(this.file).size;
      if (size < this.maxBytes) return;
      fs.renameSync(this.file, path.join(path.dirname(this.file), `${this.name}.1.log`));
    } catch {
      // No file yet, or a rename that lost a race - either way, keep writing.
    }
  }

  write(level, source, message) {
    if (!this.ensureFile()) return;
    const text = String(message ?? '').replace(/\r?\n/g, ' ').slice(0, 2000);
    const line = `${new Date().toISOString()}  ${String(level).toUpperCase().padEnd(5)}  ${String(source).padEnd(10)}  ${text}\n`;
    try {
      this.rotateIfNeeded();
      fs.appendFileSync(this.file, line);
    } catch {
      this.broken = true;
    }
  }

  info(source, message) { this.write('info', source, message); }
  warn(source, message) { this.write('warn', source, message); }
  error(source, message) { this.write('error', source, message); }

  get filePath() { return this.ensureFile(); }
}

/** One log per main process - the windows all share it through this module. */
export const desktopLog = new LogFile();

/**
 * Sends a web page's console into the log.
 *
 * Electron 36 replaced the `(event, level, message, line, sourceId)` arguments
 * with a single details object, and 38 no longer emits the old shape at all -
 * both are accepted here so this keeps working across an upgrade either way.
 */
export function logConsoleFrom(webContents, source) {
  if (!webContents || webContents.isDestroyed()) return;

  webContents.on('console-message', (...args) => {
    const details = args[0] && typeof args[0] === 'object' && 'message' in args[0]
      ? args[0]
      : { level: args[1], message: args[2], lineNumber: args[3], sourceId: args[4] };

    const level = normalizeLevel(details.level);
    const where = details.sourceId ? ` (${shortenSource(details.sourceId)}:${details.lineNumber ?? '?'})` : '';
    desktopLog.write(level, source, `${details.message}${where}`);
  });

  webContents.on('render-process-gone', (_event, killDetails) => {
    desktopLog.error(source, `render process gone: ${killDetails?.reason} (exit ${killDetails?.exitCode})`);
  });

  webContents.on('did-fail-load', (_event, code, description, url) => {
    // -3 is ERR_ABORTED, which every cancelled navigation reports. Logging it
    // would bury the real failures under noise from ordinary page changes.
    if (code === -3) return;
    desktopLog.error(source, `did-fail-load ${code} ${description} - ${url}`);
  });
}

/** Chromium reports levels as numbers in the old shape, as words in the new. */
function normalizeLevel(level) {
  if (typeof level === 'string') return level === 'warning' ? 'warn' : level;
  return ['debug', 'info', 'warn', 'error'][level] || 'info';
}

/** A bundle url is long and its tail is the only part that says anything. */
function shortenSource(sourceId) {
  const text = String(sourceId);
  const cut = text.lastIndexOf('/');
  return cut === -1 ? text : text.slice(cut + 1);
}
