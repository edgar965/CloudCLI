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
 * Turns dictation on for this profile.
 *
 * A profile that predates the default carries `voiceEnabled: false` written
 * out explicitly - the defaults land in localStorage the moment any other
 * preference is touched - and then the mic never appears no matter what the
 * default says. A launcher can set it straight.
 */
function applyVoiceEnabled(enabled) {
  let preferences = {};
  try {
    preferences = JSON.parse(localStorage.getItem('uiPreferences') || '{}') || {};
  } catch {
    preferences = {};
  }

  localStorage.setItem('uiPreferences', JSON.stringify({ ...preferences, voiceEnabled: enabled }));
}

/**
 * Provider, model and reasoning effort, in the keys the chat itself writes.
 *
 * Taken from `useChatProviderState`, not invented here: the provider lives in
 * `selected-provider`, the model in `<provider>-model` and the effort in
 * `<provider>-effort`. Writing the same keys means the menus next to the
 * message box come up on those values.
 */
function applyModelChoice(provider, model, effort) {
  if (provider) {
    localStorage.setItem('selected-provider', provider);
  }

  const target = provider || localStorage.getItem('selected-provider') || 'claude';
  if (model) {
    localStorage.setItem(`${target}-model`, model);
  }
  if (effort) {
    localStorage.setItem(`${target}-effort`, effort);
  }
}

/**
 * Reads the handover parameters from the start url and applies them.
 *
 * `token` is a login handed over from a launcher, `bypass=1` turns off the
 * permission prompts the same way the setting in the ui does, and
 * `provider`/`model`/`effort` preselect what a fresh profile would otherwise
 * fall back to. Values are not checked against the catalog here - the menus
 * show what the provider actually offers, and an unknown one is visible there
 * rather than silently swallowed.
 */
export function applyUrlHandover() {
  try {
    const startUrl = new URL(window.location.href);
    const token = startUrl.searchParams.get('token');
    const bypass = startUrl.searchParams.get('bypass');
    const provider = startUrl.searchParams.get('provider');
    const model = startUrl.searchParams.get('model');
    const effort = startUrl.searchParams.get('effort');
    const voice = startUrl.searchParams.get('voice');

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

    if (provider || model || effort) {
      applyModelChoice(provider, model, effort);
      for (const name of ['provider', 'model', 'effort']) {
        startUrl.searchParams.delete(name);
      }
    }

    if (voice !== null) {
      applyVoiceEnabled(voice === '1' || voice === 'true');
      startUrl.searchParams.delete('voice');
    }

    if (token || bypass !== null || provider || model || effort || voice !== null) {
      window.history.replaceState({}, '', `${startUrl.pathname}${startUrl.search}${startUrl.hash}`);
    }
  } catch (error) {
    console.warn('Could not read the handover from the address:', error);
  }
}
