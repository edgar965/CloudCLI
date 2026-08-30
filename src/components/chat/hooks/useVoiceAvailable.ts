import { useEffect, useState } from 'react';

import { authenticatedFetch } from '../../../utils/api';
import { readVoiceConfig, VOICE_CONFIG_SYNC_EVENT } from '../../../hooks/useVoiceConfig';

import { isSpeechRecognitionSupported } from './useSpeechRecognition';

// Voice UI is gated on the `voiceEnabled` UI preference (toggled in Quick Settings /
// the Settings modal) and a configured voice backend.
const STORAGE_KEY = 'uiPreferences';
const SYNC_EVENT = 'ui-preferences:sync';
let healthRequest: Promise<boolean> | null = null;

function checkVoiceHealth(): Promise<boolean> {
  if (healthRequest) return healthRequest;
  const request = authenticatedFetch('/api/voice/health')
    .then(async (response) => {
      if (!response.ok) throw new Error(`Voice health check failed (${response.status})`);
      const data = await response.json();
      return data?.configured === true;
    })
    .finally(() => {
      healthRequest = null;
    });
  healthRequest = request;
  return request;
}

/**
 * Dictation is on unless it was switched off.
 *
 * It used to default to off, which meant a fresh profile showed no mic at all
 * and nothing said why. It only ever appeared for someone who had both set the
 * preference and configured a whisper backend. Now the preference just has to
 * not say "off" - whether dictation is possible is decided further down, by
 * whether the browser can do it or a backend is configured.
 */
function readVoiceEnabled(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return true;
    const parsed = JSON.parse(raw);
    if (parsed?.voiceEnabled === false || parsed?.voiceEnabled === 'false') {
      return false;
    }
    // Anything else - true, or a profile that never touched the setting.
    return true;
  } catch {
    return true;
  }
}

export function useVoiceAvailable(): boolean {
  const [enabled, setEnabled] = useState<boolean>(() =>
    typeof window === 'undefined' ? false : readVoiceEnabled(),
  );
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    const update = () => setEnabled(readVoiceEnabled());
    window.addEventListener('storage', update);
    window.addEventListener(SYNC_EVENT, update as EventListener);
    return () => {
      window.removeEventListener('storage', update);
      window.removeEventListener(SYNC_EVENT, update as EventListener);
    };
  }, []);

  useEffect(() => {
    let active = true;
    let requestId = 0;

    const check = async () => {
      if (!enabled) {
        setAvailable(false);
        return;
      }
      if (readVoiceConfig().baseUrl.trim()) {
        setAvailable(true);
        return;
      }
      const id = ++requestId;
      try {
        const result = await checkVoiceHealth();
        // Without a transcription backend the browser can still dictate, the
        // way the Claude Chrome extension does it - so the mic stays offered
        // rather than disappearing for want of an API key.
        if (active && id === requestId) setAvailable(result || isSpeechRecognitionSupported());
      } catch {
        if (active && id === requestId) setAvailable(isSpeechRecognitionSupported());
      }
    };

    void check();
    window.addEventListener(VOICE_CONFIG_SYNC_EVENT, check);
    return () => {
      active = false;
      window.removeEventListener(VOICE_CONFIG_SYNC_EVENT, check);
    };
  }, [enabled]);

  return enabled && available;
}

/**
 * Whether a transcription backend is actually reachable, as opposed to the mic
 * merely being offered. The composer needs the difference: with a backend it
 * records audio and posts it to /api/voice/transcribe, without one it lets the
 * browser do the recognising.
 */
export function useVoiceBackendReady(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    const check = async () => {
      if (readVoiceConfig().baseUrl.trim()) {
        if (active) setReady(true);
        return;
      }

      try {
        const result = await checkVoiceHealth();
        if (active) setReady(result);
      } catch {
        if (active) setReady(false);
      }
    };

    void check();
    window.addEventListener(VOICE_CONFIG_SYNC_EVENT, check);
    return () => {
      active = false;
      window.removeEventListener(VOICE_CONFIG_SYNC_EVENT, check);
    };
  }, []);

  return ready;
}
