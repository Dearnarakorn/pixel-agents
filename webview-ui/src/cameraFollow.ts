import { CAMERA_FOLLOW_STORAGE_KEY } from './constants.js';

/**
 * Whether selecting an agent moves the camera to it and keeps it centred.
 * A per-browser preference (like the radio's volume): on unless switched off
 * in Settings. With it off a click still selects the agent; the view stays put.
 */
let enabled = read();

function read(): boolean {
  try {
    return window.localStorage.getItem(CAMERA_FOLLOW_STORAGE_KEY) !== 'off';
  } catch {
    return true; // storage unavailable: the default
  }
}

export function isCameraFollowEnabled(): boolean {
  return enabled;
}

export function setCameraFollowEnabled(on: boolean): void {
  enabled = on;
  try {
    window.localStorage.setItem(CAMERA_FOLLOW_STORAGE_KEY, on ? 'on' : 'off');
  } catch {
    // storage unavailable: the choice lasts for this page only
  }
}
