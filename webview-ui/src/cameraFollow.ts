import { CAMERA_FOLLOW_STORAGE_KEY } from './constants.js';

/**
 * Whether selecting an agent moves the camera to it and keeps it centred.
 * A per-browser preference (like the radio's volume): on unless switched off
 * in Settings. With it off a click still selects the agent; the view stays put.
 *
 * The office engine reads this, and the engine is DOM-free (it also runs under
 * Node in the unit tests), so storage is reached through globalThis with its
 * own minimal type rather than through `window`.
 */
interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function storage(): KeyValueStorage | undefined {
  return (globalThis as { localStorage?: KeyValueStorage }).localStorage;
}

function read(): boolean {
  try {
    return storage()?.getItem(CAMERA_FOLLOW_STORAGE_KEY) !== 'off';
  } catch {
    return true; // storage unavailable: the default
  }
}

let enabled = read();

export function isCameraFollowEnabled(): boolean {
  return enabled;
}

export function setCameraFollowEnabled(on: boolean): void {
  enabled = on;
  try {
    storage()?.setItem(CAMERA_FOLLOW_STORAGE_KEY, on ? 'on' : 'off');
  } catch {
    // storage unavailable: the choice lasts for this page only
  }
}
