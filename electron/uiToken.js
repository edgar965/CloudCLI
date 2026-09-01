import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Shares the web UI's login between desktop profiles.
 *
 * The UI keeps its JWT in `localStorage` under `auth-token`, which belongs to
 * the Electron profile. Running several windows side by side needs one
 * `--user-data-dir` each (the single-instance lock is keyed on that path), so
 * every window would otherwise ask for its own login.
 *
 * This module keeps a copy of the token in a file next to the database, which
 * all profiles read: log in once, every other window picks it up. The file is
 * as sensitive as the login itself and stays in the user's own directory,
 * beside `auth.db` — anyone who can read it can already read that.
 */

const TOKEN_FILE = path.join(os.homedir(), '.cloudcli', 'ui-token.json');
const STORAGE_KEY = 'auth-token';

/**
 * Is the token still valid for a while, judging by its `exp` claim?
 *
 * The signature is not checked - that is the server's job and the secret is
 * not here. This only has to spot the expired token a profile kept from an
 * earlier session, so that a fresh one from the file wins instead of the stale
 * one being written back over it.
 */
function looksUsable(token) {
  const payload = String(token || '').split('.')[1];
  if (!payload) {
    return false;
  }

  try {
    const json = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    const claims = JSON.parse(json);
    if (typeof claims?.exp !== 'number') {
      // No expiry claim: nothing speaks against it.
      return true;
    }
    // A minute of slack so a token about to lapse is not treated as fresh.
    return claims.exp * 1000 > Date.now() + 60_000;
  } catch {
    return false;
  }
}

async function readSharedToken() {
  try {
    const raw = await fs.readFile(TOKEN_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    const token = typeof parsed?.token === 'string' ? parsed.token.trim() : '';
    return token || null;
  } catch {
    return null;
  }
}

async function writeSharedToken(token) {
  try {
    // Owner-only, both times. The file holds a bearer token: written with the
    // default mask it comes out world-readable on a shared machine, and anyone
    // who can read it can replay it. The mode on writeFile only applies when
    // the file is created, so an existing one is corrected explicitly.
    await fs.mkdir(path.dirname(TOKEN_FILE), { recursive: true, mode: 0o700 });
    await fs.writeFile(
      TOKEN_FILE,
      `${JSON.stringify({ token, updatedAt: new Date().toISOString() }, null, 2)}
`,
      { encoding: 'utf8', mode: 0o600 },
    );
    // A no-op on Windows, where the ACL of the user's profile does this job.
    await fs.chmod(TOKEN_FILE, 0o600).catch(() => {});
  } catch (error) {
    console.warn('[ui-token] Could not store the shared token:', error.message);
  }
}

/**
 * Reconciles the shared token file with one view's `localStorage`.
 *
 * - view has a token: it wins and is written to the file (a fresh login
 *   reaches the other profiles this way).
 * - view has none but the file does: the token is placed in `localStorage`.
 *
 * @returns {Promise<boolean>} true when the view was given a token and has to
 *   be reloaded for the UI to notice it.
 */
export async function syncSharedUiToken(webContents) {
  if (!webContents || webContents.isDestroyed()) {
    return false;
  }

  let current = null;
  try {
    current = await webContents.executeJavaScript(
      `window.localStorage.getItem(${JSON.stringify(STORAGE_KEY)})`,
      true,
    );
  } catch {
    return false;
  }

  const shared = await readSharedToken();

  if (typeof current === 'string' && current && looksUsable(current)) {
    if (shared !== current) {
      await writeSharedToken(current);
    }
    return false;
  }

  // Nothing usable in this profile: an empty slot, or a token that has run
  // out. Either way the shared file decides - as long as it is any better.
  if (!shared || !looksUsable(shared) || shared === current) {
    return false;
  }

  try {
    await webContents.executeJavaScript(
      `window.localStorage.setItem(${JSON.stringify(STORAGE_KEY)}, ${JSON.stringify(shared)})`,
      true,
    );
  } catch {
    return false;
  }

  return true;
}
