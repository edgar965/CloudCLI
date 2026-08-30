/**
 * Settings a launcher can hand over in the address of the start url.
 *
 * A desktop window runs with its own Electron profile (the single-instance
 * lock is keyed on `--user-data-dir`), so a fresh profile starts with an empty
 * localStorage: no login, and none of the settings made in another window.
 * The launcher passes them in the address instead, and they are applied before
 * React mounts and reads the store. Everything is removed from the address
 * right after, so nothing lingers in the history or in a shared link.
 */

/** Provider settings that carry a `skipPermissions` flag. */
const PERMISSION_SETTINGS_KEYS = [
  'claude-settings',
  'cursor-tools-settings',
  'opencode-settings',
];

/** Turns on "skip permissions" for every provider that knows the flag. */
function applyBypassPermissions() {
  for (const key of PERMISSION_SETTINGS_KEYS) {
    let settings = {};
    try {
      settings = JSON.parse(localStorage.getItem(key) || '{}') || {};
    } catch {
      // A damaged entry is replaced rather than kept.
      settings = {};
    }

    localStorage.setItem(key, JSON.stringify({
      ...settings,
      skipPermissions: true,
      lastUpdated: new Date().toISOString(),
    }));
  }
}

/**
 * Reads `?token=` and `?bypass=` from the start url and applies them.
 *
 * `token` is a login handed over from a launcher, `bypass=1` turns off the
 * permission prompts the same way the setting in the ui does.
 */
export function applyUrlHandover() {
  try {
    const startUrl = new URL(window.location.href);
    const token = startUrl.searchParams.get('token');
    const bypass = startUrl.searchParams.get('bypass');

    if (token) {
      localStorage.setItem('auth-token', token);
      startUrl.searchParams.delete('token');
    }

    if (bypass === '1' || bypass === 'true') {
      applyBypassPermissions();
    }
    if (bypass !== null) {
      startUrl.searchParams.delete('bypass');
    }

    if (token || bypass !== null) {
      window.history.replaceState({}, '', `${startUrl.pathname}${startUrl.search}${startUrl.hash}`);
    }
  } catch (error) {
    console.warn('Could not read the handover from the address:', error);
  }
}
