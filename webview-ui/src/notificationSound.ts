import {
  NOTIFICATION_MIN_GAIN,
  NOTIFICATION_NOTE_1_HZ,
  NOTIFICATION_NOTE_1_START_SEC,
  NOTIFICATION_NOTE_2_HZ,
  NOTIFICATION_NOTE_2_START_SEC,
  NOTIFICATION_NOTE_DURATION_SEC,
  NOTIFICATION_VOLUME,
  NOTIFICATION_VOLUME_DEFAULT_PCT,
  NOTIFICATION_VOLUME_STORAGE_KEY,
  PERMISSION_NOTE_1_HZ,
  PERMISSION_NOTE_1_START_SEC,
  PERMISSION_NOTE_2_HZ,
  PERMISSION_NOTE_2_START_SEC,
  PERMISSION_NOTE_DURATION_SEC,
  PERMISSION_VOLUME,
} from './constants.js';
import { isE2E } from './runtime.js';

let soundEnabled = true;
let audioCtx: AudioContext | null = null;

/** E2E test hook: append every (attempted) sound invocation to a window-side log
 *  under window.__pixelAgentsTestHooks.playedSounds (namespace and type
 *  declared by testHooks.ts). Records BEFORE the soundEnabled gate so tests
 *  verify dispatch independent of user audio prefs. Gated on the e2e harness
 *  flag so this unbounded log never grows in a real session. */
function recordSoundForTests(kind: 'done' | 'permission'): void {
  if (!isE2E || typeof window === 'undefined') return;
  if (!window.__pixelAgentsTestHooks) window.__pixelAgentsTestHooks = {};
  if (!window.__pixelAgentsTestHooks.playedSounds) {
    window.__pixelAgentsTestHooks.playedSounds = [];
  }
  window.__pixelAgentsTestHooks.playedSounds.push({ kind, at: Date.now() });
}

export function setSoundEnabled(enabled: boolean): void {
  soundEnabled = enabled;
}

export function isSoundEnabled(): boolean {
  return soundEnabled;
}

/** How loud the sounds play, as a percent (0-100) of their designed volume.
 *  Kept per browser; anything unreadable falls back to the default. */
export function getNotificationVolumePct(): number {
  try {
    const raw = window.localStorage.getItem(NOTIFICATION_VOLUME_STORAGE_KEY);
    const value = raw === null || raw === '' ? NaN : Number(raw);
    if (Number.isFinite(value)) return Math.min(100, Math.max(0, value));
  } catch {
    // storage unavailable: use the default
  }
  return NOTIFICATION_VOLUME_DEFAULT_PCT;
}

export function setNotificationVolumePct(pct: number): void {
  try {
    window.localStorage.setItem(
      NOTIFICATION_VOLUME_STORAGE_KEY,
      String(Math.min(100, Math.max(0, pct))),
    );
  } catch {
    // storage unavailable: the choice lasts for this page only
  }
}

function playNote(
  ctx: AudioContext,
  freq: number,
  startOffset: number,
  duration: number = NOTIFICATION_NOTE_DURATION_SEC,
  volume: number = NOTIFICATION_VOLUME,
): void {
  const t = ctx.currentTime + startOffset;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, t);

  const scaled = (volume * getNotificationVolumePct()) / 100;
  gain.gain.setValueAtTime(Math.max(NOTIFICATION_MIN_GAIN, scaled), t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(t);
  osc.stop(t + duration);
}

export async function playDoneSound(): Promise<void> {
  recordSoundForTests('done');
  if (!soundEnabled) return;
  try {
    if (!audioCtx) {
      audioCtx = new AudioContext();
    }
    // Resume suspended context (webviews suspend until user gesture)
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
    }
    // Ascending two-note chime: E5 → B5
    playNote(audioCtx, NOTIFICATION_NOTE_1_HZ, NOTIFICATION_NOTE_1_START_SEC);
    playNote(audioCtx, NOTIFICATION_NOTE_2_HZ, NOTIFICATION_NOTE_2_START_SEC);
  } catch {
    // Audio may not be available
  }
}

export async function playPermissionSound(): Promise<void> {
  recordSoundForTests('permission');
  if (!soundEnabled) return;
  try {
    if (!audioCtx) {
      audioCtx = new AudioContext();
    }
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
    }
    // Descending two-note tap: A5 → E5
    playNote(
      audioCtx,
      PERMISSION_NOTE_1_HZ,
      PERMISSION_NOTE_1_START_SEC,
      PERMISSION_NOTE_DURATION_SEC,
      PERMISSION_VOLUME,
    );
    playNote(
      audioCtx,
      PERMISSION_NOTE_2_HZ,
      PERMISSION_NOTE_2_START_SEC,
      PERMISSION_NOTE_DURATION_SEC,
      PERMISSION_VOLUME,
    );
  } catch {
    // Audio may not be available
  }
}

/** Call from any user-gesture handler to ensure AudioContext is unlocked */
export function unlockAudio(): void {
  try {
    if (!audioCtx) {
      audioCtx = new AudioContext();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  } catch {
    // ignore
  }
}
