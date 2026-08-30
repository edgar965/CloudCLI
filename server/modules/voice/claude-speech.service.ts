import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import WebSocket from 'ws';

/**
 * Dictation through Anthropic's own speech-to-text, the one Claude Code uses.
 *
 * Read out of the cli rather than guessed. It opens a websocket and streams raw
 * PCM at it:
 *
 *   L = "/api/ws/speech_to_text/voice_stream"
 *   C = VOICE_STREAM_BASE_URL || BASE_API_URL.replace("https://","wss://")
 *   E = { encoding:"linear16", sample_rate:"16000", channels:"1",
 *         endpointing_ms:"300", utterance_end_ms:"1000",
 *         language: …, use_conversation_engine:"true" }
 *   k = { Authorization:`Bearer ${accessToken}`, "x-app":"cli", … }
 *   … i.send(Buffer.from(chunk)) …            audio, as binary frames
 *   … i.send('{"type":"CloseStream"}')        to finish
 *
 * What comes back, measured against four seconds of synthesised German speech:
 *
 *   {"type": "TranscriptText", "data": "Dies ist ein Test der Spracherkennung"}
 *   {"type": "TranscriptText", "data": "Dies ist ein Test der Spracherkennung von Claude Code."}
 *   {"type": "TranscriptEndpoint"}
 *
 * `data` is the whole transcript so far, not the newest words - each message
 * replaces the last. `TranscriptEndpoint` marks the end.
 *
 * This is an internal endpoint of Claude Code, not a documented API. It is
 * reached with the user's own Claude credentials and only when they ask for it.
 */

const STREAM_PATH = '/api/ws/speech_to_text/voice_stream';
const DEFAULT_API_BASE = 'https://api.anthropic.com';

export type SpeechCredentials = { accessToken: string };

/** Reads the token Claude Code stores, in the order the cli looks for it. */
export async function readClaudeToken(): Promise<string | null> {
  const fromEnv = (process.env.CLAUDE_CODE_OAUTH_TOKEN || '').trim();
  if (fromEnv) {
    return fromEnv;
  }

  try {
    const file = path.join(os.homedir(), '.claude', '.credentials.json');
    const parsed = JSON.parse(await fs.readFile(file, 'utf8')) as {
      claudeAiOauth?: { accessToken?: unknown; expiresAt?: unknown };
    };

    const token = parsed?.claudeAiOauth?.accessToken;
    if (typeof token !== 'string' || !token.trim()) {
      return null;
    }

    // An expired token is refused upstream anyway; saying so here is clearer
    // than a websocket that closes without explanation.
    const expiresAt = parsed.claudeAiOauth?.expiresAt;
    if (typeof expiresAt === 'number' && Date.now() >= expiresAt) {
      return null;
    }

    return token;
  } catch {
    return null;
  }
}

export type SpeechEvents = {
  /** The transcript so far - replaces whatever came before. */
  onTranscript: (text: string) => void;
  onEnd: () => void;
  onError: (message: string) => void;
};

export class ClaudeSpeechStream {
  private upstream: WebSocket | null = null;

  private closing = false;

  /**
   * Audio that arrived before the upstream socket finished opening.
   *
   * Connecting takes a moment, and the microphone does not wait: dropping those
   * first chunks costs the first words. Measured with four seconds of speech
   * sent immediately, "Dies ist ein Test …" came back as "ein Test …".
   */
  private queued: Buffer[] = [];

  /** A `stop` that arrived while the stream was still opening. */
  private finishQueued = false;

  constructor(private readonly events: SpeechEvents) {}

  async open(language: string): Promise<void> {
    const token = await readClaudeToken();
    if (!token) {
      this.events.onError('No Claude credentials. Run "claude /login" once.');
      return;
    }

    const base = (process.env.VOICE_STREAM_BASE_URL || DEFAULT_API_BASE)
      .replace(/^https:\/\//, 'wss://')
      .replace(/^http:\/\//, 'ws://')
      .replace(/\/$/, '');

    const params = new URLSearchParams({
      encoding: 'linear16',
      sample_rate: '16000',
      channels: '1',
      endpointing_ms: '300',
      utterance_end_ms: '1000',
      language: language || 'en',
      use_conversation_engine: 'true',
    });

    const socket = new WebSocket(`${base}${STREAM_PATH}?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-app': 'cli',
        'anthropic-client-platform': 'cli',
      },
    });

    socket.on('open', () => {
      // Whatever the microphone produced while connecting goes first, in
      // order, before anything new.
      for (const chunk of this.queued) {
        socket.send(chunk);
      }
      this.queued = [];
      if (this.finishQueued) {
        this.finishQueued = false;
        socket.send('{"type":"CloseStream"}');
      }
    });
    socket.on('message', (raw: Buffer) => this.handleMessage(raw.toString()));
    socket.on('error', (error: Error) => this.events.onError(error.message));
    socket.on('close', () => {
      this.upstream = null;
      if (!this.closing) {
        this.events.onEnd();
      }
    });

    this.upstream = socket;
  }

  private handleMessage(text: string): void {
    try {
      const message = JSON.parse(text) as { type?: string; data?: unknown };
      if (message.type === 'TranscriptText' && typeof message.data === 'string') {
        this.events.onTranscript(message.data);
        return;
      }
      if (message.type === 'TranscriptEndpoint') {
        this.events.onEnd();
      }
    } catch {
      // Anything that is not json is not ours to interpret.
    }
  }

  /** One chunk of 16 kHz mono PCM16, exactly as the cli sends it. */
  send(chunk: Buffer): void {
    if (this.upstream?.readyState === WebSocket.OPEN) {
      this.upstream.send(chunk);
      return;
    }

    // Still connecting - hold it rather than lose the opening words. Capped so
    // an upstream that never opens cannot grow without end (~30 s of audio).
    if (!this.closing && this.queued.length < 300) {
      this.queued.push(chunk);
    }
  }

  /** Asks for the final transcript and lets the stream finish. */
  finish(): void {
    if (this.upstream?.readyState === WebSocket.OPEN) {
      this.upstream.send('{"type":"CloseStream"}');
      return;
    }

    // Spoken and released before the stream was up: finish once it is.
    this.finishQueued = true;
  }

  close(): void {
    this.closing = true;
    this.upstream?.close();
    this.upstream = null;
  }
}
