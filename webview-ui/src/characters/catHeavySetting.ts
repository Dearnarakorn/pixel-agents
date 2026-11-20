/**
 * The heavy-cat threshold as this browser keeps it (localStorage, like the
 * notification volume): read once at startup into office/engine/catHeavy.ts,
 * written by Settings. Storage can be missing or refuse (a private window):
 * then the default holds, or the choice lasts for this page only.
 */

import { CAT_HEAVY_DEFAULT_PCT, CAT_HEAVY_STORAGE_KEY } from '../constants.js';
import { clampCatHeavyPct, setCatHeavyThresholdPct } from '../office/engine/catHeavy.js';

export function readStoredCatHeavyPct(): number {
  try {
    const raw = window.localStorage.getItem(CAT_HEAVY_STORAGE_KEY);
    const value = raw === null || raw === '' ? NaN : Number(raw);
    if (Number.isFinite(value)) return clampCatHeavyPct(value);
  } catch {
    // storage unavailable: use the default
  }
  return CAT_HEAVY_DEFAULT_PCT;
}

/** Use `pct` from now on, and keep it for this browser. */
export function storeCatHeavyPct(pct: number): void {
  const value = clampCatHeavyPct(pct);
  setCatHeavyThresholdPct(value);
  try {
    window.localStorage.setItem(CAT_HEAVY_STORAGE_KEY, String(value));
  } catch {
    // storage unavailable: the choice lasts for this page only
  }
}

/** Apply the stored threshold (once, at startup). */
export function initCatHeavySetting(): void {
  setCatHeavyThresholdPct(readStoredCatHeavyPct());
}
