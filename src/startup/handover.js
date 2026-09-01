/**
 * Settings a launcher can hand over in the address of the start url.
 *
 * A desktop window runs with its own Electron profile (the single-instance
 * lock is keyed on `--user-data-dir`), so a fresh profile starts with an empty
 * localStorage: no login, and none of the settings made in another window.
 * The launcher passes them in the address instead. Everything is removed from
 * the address right after, so nothing lingers in the history or in a shared
 * link.
 *
 * Two moments are involved, because the settings no longer live in the same
 * place. The login token and the per-provider model choice are still
 * localStorage and are applied before React mounts. Provider, dictation and
 * the permission bypass moved into `auth.db`, which is only read once there is
 * a user to read it for - so those are remembered here and written by
 * `applyHandoverPreferences` after the store has hydrated. Writing them any
 * earlier means the hydrate lands on top of them and the launcher's settings
 * silently do nothing.
 */

import { readUserPreference, writeUserPreferences } from '@/shared/userSettings';

/** Preference keys holding a `skipPermissions` flag, one per provider. */
const PERMISSION_PREFERENCE_KEYS = [
  'claudePermissions',
  'cursorPermissions',
  'codexPermissions',
  'opencodePermissions',
];

/** What the address asked for, applied once the preference store is ready. */
let pendingPreferences = null;

/**
 * Provider, model and reasoning effort, in the keys the chat itself uses.
 *
 * Model and effort are read from localStorage by `useChatProviderState`
 * (`<provider>-model`, `<provider>-effort`), so they are written here directly.
 * The provider itself is a stored preference and goes through the store.
 */
function applyModelChoice(provider, model, effort) {
  const target = provider || readUserPreference('selectedProvider', null) || 'claude';
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
 * permission prompts the same way the setting in the ui does, `voice` switches
 * dictation, and `provider`/`model`/`effort` preselect what a fresh profile
 * would otherwise fall back to. Values are not checked against the catalog
 * here - the menus show what the provider actually offers, and an unknown one
 * is visible there rather than silently swallowed.
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
      startUrl.searchParams.delete('voice');
    }

    pendingPreferences = {
      provider: provider || null,
      bypass: bypass === '1' || bypass === 'true',
      voice: voice === null ? null : voice === '1' || voice === 'true',
    };

    if (token || bypass !== null || provider || model || effort || voice !== null) {
      window.history.replaceState({}, '', `${startUrl.pathname}${startUrl.search}${startUrl.hash}`);
    }
  } catch (error) {
    console.warn('Could not read the handover from the address:', error);
  }
}

/**
 * Writes the handed-over settings into the preference store.
 *
 * Called right after the store has read the server's copy, so these values win
 * over what the profile had - that is the point of putting them in the start
 * url. Runs once: a later hydrate (another sign-in on this device) must not
 * silently re-apply an address the user has long since navigated away from.
 */
export function applyHandoverPreferences() {
  const handover = pendingPreferences;
  pendingPreferences = null;
  if (!handover) {
    return;
  }

  try {
    const updates = {};

    if (handover.provider) {
      updates.selectedProvider = handover.provider;
    }

    if (handover.bypass) {
      for (const key of PERMISSION_PREFERENCE_KEYS) {
        const stored = readUserPreference(key, {});
        const settings = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
        updates[key] = { ...settings, skipPermissions: true };
      }
    }

    if (handover.voice !== null) {
      const stored = readUserPreference('uiPreferences', {});
      const preferences = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
      updates.uiPreferences = { ...preferences, voiceEnabled: handover.voice };
    }

    if (Object.keys(updates).length > 0) {
      writeUserPreferences(updates);
    }
  } catch (error) {
    console.warn('Could not apply the handover settings:', error);
  }
}
