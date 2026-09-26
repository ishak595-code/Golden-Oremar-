import { registerPlugin } from '@capacitor/core';

/**
 * The one registration of the native speech plugin (MainActivity.kt,
 * NativeSpeechPlugin). Capacitor allows a plugin name to be registered once;
 * it was registered in both src/native.ts and voiceSearchAdapter.ts, which
 * logged "already registered" on every start and left two handles to the same
 * bridge. Both now import this one.
 *
 * Field types are deliberately loose (unknown): each caller validates what it
 * reads, as before.
 */
export type NativeSpeechResult = { text?: unknown; matches?: unknown };
export type NativeSpeechPlugin = {
  available(options?: { language?: string }): Promise<{ available?: boolean }>;
  start(options?: { language?: string }): Promise<NativeSpeechResult>;
  stop(): Promise<void>;
};

export const NativeSpeech = registerPlugin<NativeSpeechPlugin>('NativeSpeech');
