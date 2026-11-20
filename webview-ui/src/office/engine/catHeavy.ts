/**
 * Heavy cats (Cat theme): an agent's cat is drawn heavy -- its coat's heavy
 * sheet, characters/cats/heavy/ -- once its context fills past a threshold, and
 * slim again when the context drops (a compaction, a /clear). The threshold is
 * a per-browser setting (Settings, kept by characters/catHeavySetting.ts);
 * CAT_HEAVY_OFF_PCT turns it off. Sub-agents report no context, so they stay slim.
 * DOM-free.
 */

import { CAT_HEAVY_DEFAULT_PCT, CAT_HEAVY_MIN_PCT, CAT_HEAVY_OFF_PCT } from '../../constants.js';
import type { Character } from '../types.js';
import { isCatBehaviour } from './catBehaviour.js';

let thresholdPct = CAT_HEAVY_DEFAULT_PCT;

/** A stored or typed value as a threshold: whole steps inside the slider's range. */
export function clampCatHeavyPct(pct: number): number {
  if (!Number.isFinite(pct)) return CAT_HEAVY_DEFAULT_PCT;
  return Math.min(CAT_HEAVY_OFF_PCT, Math.max(CAT_HEAVY_MIN_PCT, Math.round(pct)));
}

export function setCatHeavyThresholdPct(pct: number): void {
  thresholdPct = clampCatHeavyPct(pct);
}

export function getCatHeavyThresholdPct(): number {
  return thresholdPct;
}

/** Whether a character is drawn as a heavy cat: Cat theme on, heavy cats not off, and
 *  its context used at or past the threshold. */
export function isCatHeavy(ch: Pick<Character, 'contextTokens' | 'maxContextTokens'>): boolean {
  if (!isCatBehaviour() || thresholdPct >= CAT_HEAVY_OFF_PCT) return false;
  const { contextTokens, maxContextTokens } = ch;
  if (!Number.isFinite(contextTokens) || contextTokens <= 0 || !(maxContextTokens > 0)) return false;
  return (contextTokens / maxContextTokens) * 100 >= thresholdPct;
}
