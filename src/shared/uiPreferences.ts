import { readUserPreference, writeUserPreference } from '@/shared/userSettings';

/**
 * The boolean UI preferences and their reducer, kept separate from the provider
 * so the state transitions are unit-testable without rendering anything.
 *
 * The values are stored in `auth.db` through the preference store, so a toggle
 * made on one device is in effect on the next.
 */

/** Toggles the user controls from Quick Settings and the Settings dialog. */
export type UiPreferences = {
  showRawParameters: boolean;
  showThinking: boolean;
  sendByCtrlEnter: boolean;
  sidebarVisible: boolean;
  voiceEnabled: boolean;
};

export type UiPreferenceKey = keyof UiPreferences;

export type UiPreferencesAction =
  | { type: 'set'; key: UiPreferenceKey; value: unknown }
  | { type: 'set_many'; value?: Partial<Record<UiPreferenceKey, unknown>> };

const DEFAULTS: UiPreferences = {
  showRawParameters: false,
  showThinking: true,
  sendByCtrlEnter: false,
  sidebarVisible: true,
  // Dictation is offered by default. The `false` here was the reason the mic
  // never appeared: the defaults are written to the store as soon as any other
  // preference is touched, so `voiceEnabled: false` ended up saved explicitly
  // in every profile and stayed there. Whether dictation is possible at all is
  // decided elsewhere - a transcription backend, or the browser's own
  // recognition.
  voiceEnabled: true,
};

/**
 * Marks that the one-time lift of `voiceEnabled` has already happened.
 *
 * Kept beside the preferences rather than inside them: that blob is rewritten
 * from state on every change, and a marker held in there would be dropped by
 * the next write - so switching dictation off would be undone again on the
 * following reload. It is per-device on purpose; the lift is about a value
 * that was saved without anyone choosing it.
 */
const VOICE_DEFAULT_LIFTED = 'voiceEnabledDefaultApplied';

const hasLiftedVoiceDefault = (): boolean => {
  try {
    return localStorage.getItem(VOICE_DEFAULT_LIFTED) === 'true';
  } catch {
    // No storage (a private window, or a test): treat it as not yet lifted.
    return false;
  }
};

const rememberVoiceDefaultLifted = (): void => {
  try {
    localStorage.setItem(VOICE_DEFAULT_LIFTED, 'true');
  } catch {
    // Storage refused it; the value still holds for this session.
  }
};

const PREFERENCE_KEYS = Object.keys(DEFAULTS) as UiPreferenceKey[];
/** Prevents an unknown key from being written into the blob. */
const VALID_KEYS = new Set<UiPreferenceKey>(PREFERENCE_KEYS);

/** Values were historically stored as both real booleans and the strings. */
const parseBoolean = (value: unknown, fallback: boolean): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    if (value === 'true') return true;
    if (value === 'false') return false;
  }

  return fallback;
};

/**
 * Reads the stored preferences, filling in a default for anything the user has
 * never toggled. Synchronous, because the sidebar's visibility and the composer's
 * send-key are needed on the very first render.
 */
export const readStoredUiPreferences = (): UiPreferences => {
  const stored = readUserPreference<Record<string, unknown>>('uiPreferences', {});

  const preferences = PREFERENCE_KEYS.reduce((acc, key) => {
    acc[key] = parseBoolean(stored[key], DEFAULTS[key]);
    return acc;
  }, { ...DEFAULTS });

  // A profile written before dictation defaulted to on carries
  // `voiceEnabled: false` - not a choice anyone made, just the old default
  // that got saved the first time any other preference was touched.
  //
  // The marker is set on the first read either way, not only when something
  // was actually lifted. Setting it only on a lift left the door open: a
  // profile that reads as "on", then gets switched off by hand, would be read
  // again with no marker in place and lifted straight back on - the setting
  // could not be turned off at all.
  if (!hasLiftedVoiceDefault()) {
    rememberVoiceDefaultLifted();
    if (!preferences.voiceEnabled) {
      preferences.voiceEnabled = true;
      writeUserPreference('uiPreferences', { ...stored, voiceEnabled: true });
    }
  }

  return preferences;
};

export function uiPreferencesReducer(
  state: UiPreferences,
  action: UiPreferencesAction,
): UiPreferences {
  switch (action.type) {
    case 'set': {
      const { key, value } = action;
      if (!VALID_KEYS.has(key)) {
        return state;
      }

      const nextValue = parseBoolean(value, state[key]);
      // Returning the same object keeps consumers from re-rendering on a no-op.
      return state[key] === nextValue ? state : { ...state, [key]: nextValue };
    }
    case 'set_many': {
      const updates = action.value || {};
      let changed = false;
      const nextState = { ...state };

      for (const key of PREFERENCE_KEYS) {
        if (!(key in updates)) continue;

        const nextValue = parseBoolean(updates[key], state[key]);
        if (nextState[key] !== nextValue) {
          nextState[key] = nextValue;
          changed = true;
        }
      }

      return changed ? nextState : state;
    }
    default:
      return state;
  }
}
