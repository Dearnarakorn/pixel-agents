/**
 * Which agents are heavy cats, as this browser keeps it (localStorage, like the
 * notification volume): read once when the Cat theme turns on into
 * office/engine/catHeavy.ts, written by Settings. Storage can be missing or refuse
 * (a private window): then the default holds, or the choice lasts for this page only.
 */

import { CAT_HEAVY_DEFAULT_NAMES, CAT_HEAVY_STORAGE_KEY } from '../constants.js';
import { setCatHeavyNames } from '../office/engine/catHeavy.js';

export function readStoredCatHeavyNames(): string {
  try {
    const raw = window.localStorage.getItem(CAT_HEAVY_STORAGE_KEY);
    if (raw !== null) return raw;
  } catch {
    // storage unavailable: use the default
  }
  return CAT_HEAVY_DEFAULT_NAMES;
}

/** Use `names` from now on, and keep them for this browser. */
export function storeCatHeavyNames(names: string): void {
  setCatHeavyNames(names);
  try {
    window.localStorage.setItem(CAT_HEAVY_STORAGE_KEY, names);
  } catch {
    // storage unavailable: the choice lasts for this page only
  }
}

/** Apply the stored names (when the Cat theme turns on). */
export function initCatHeavySetting(): void {
  setCatHeavyNames(readStoredCatHeavyNames());
}
