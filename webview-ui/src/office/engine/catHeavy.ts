/**
 * The heavy cat (Cat theme): the boss of the office is a fat cat -- its coat's
 * heavy sheet, characters/cats/heavy/ -- and everyone else a slim one. Which
 * agents are heavy is a per-browser setting (Settings, kept by
 * characters/catHeavySetting.ts): names matched against an agent's conversation
 * title or its zone, "Boss" by default; empty means none. DOM-free.
 */

import { CAT_HEAVY_DEFAULT_NAMES, CAT_POOF_SEC } from '../../constants.js';
import type { Character } from '../types.js';
import { isCatBehaviour } from './catBehaviour.js';

/** The names as typed: comma separated, case and spaces round each name ignored. */
function parseNames(text: string): Set<string> {
  return new Set(
    text
      .split(',')
      .map((n) => n.trim().toLowerCase())
      .filter(Boolean),
  );
}

let namesText = CAT_HEAVY_DEFAULT_NAMES;
let names = parseNames(namesText);

export function setCatHeavyNames(text: string): void {
  namesText = text;
  names = parseNames(text);
}

export function getCatHeavyNames(): string {
  return namesText;
}

/**
 * Move a cat's drawn shape towards isCatHeavy, behind a puff of smoke: when the two
 * differ, a CAT_POOF_SEC puff starts and the shape swaps halfway through it (the cloud
 * covers the cat then). The first look, and anything outside the Cat theme, is set at
 * once with no puff, so loading the office or turning the theme on doesn't puff every cat.
 */
export function tickCatShape(
  ch: Pick<Character, 'title' | 'zone' | 'catHeavyShown' | 'catPoofSec'>,
  dt: number,
): void {
  const want = isCatHeavy(ch);
  if (!isCatBehaviour() || ch.catHeavyShown === undefined) {
    ch.catHeavyShown = isCatBehaviour() ? want : undefined;
    ch.catPoofSec = 0;
    return;
  }
  const left = ch.catPoofSec ?? 0;
  if (left <= 0) {
    if (want !== ch.catHeavyShown) ch.catPoofSec = CAT_POOF_SEC;
    return;
  }
  const next = Math.max(0, left - dt);
  // Halfway: the cloud is at its fullest, so the swap happens out of sight.
  if (left > CAT_POOF_SEC / 2 && next <= CAT_POOF_SEC / 2) ch.catHeavyShown = want;
  ch.catPoofSec = next;
}

/** How far through its puff a cat is, 0..1 (null when it isn't changing shape). */
export function catPoofProgress(ch: Pick<Character, 'catPoofSec'>): number | null {
  const left = ch.catPoofSec ?? 0;
  return left > 0 ? 1 - left / CAT_POOF_SEC : null;
}

/** One little cloud of a puff: offset from the cat's middle and radius, in world pixels. */
export interface CatPuff {
  dx: number;
  dy: number;
  r: number;
}

const PUFF_COUNT = 8;

/**
 * The puff at progress t (0..1): eight little clouds in a ring round the cat plus one in
 * the middle. They swell to cover the cat by halfway (when it changes shape), then drift
 * out and shrink away. Whole pixels, so they draw as pixel art.
 */
export function catPoofPuffs(t: number): CatPuff[] {
  const grow = t < 0.5;
  // The ring sits wide of the middle cloud, so the edge stays bumpy (a cartoon puff);
  // a middle cloud as big as the ring merged it all into one smooth blob.
  const ring = grow ? 3 + 10 * t : 8 + 12 * (t - 0.5);
  const r = grow ? 1 + 9 * t : 11 * (1 - t);
  const puffs: CatPuff[] = [];
  for (let i = 0; i < PUFF_COUNT; i++) {
    const a = (i / PUFF_COUNT) * Math.PI * 2 + t;
    puffs.push({
      dx: Math.round(Math.cos(a) * ring * 1.2),
      dy: Math.round(Math.sin(a) * ring),
      r: Math.max(0, Math.round(r)),
    });
  }
  puffs.push({ dx: 0, dy: 0, r: Math.max(0, Math.round(grow ? 1 + 12 * t : 14 * (1 - t) - 1)) });
  return puffs.filter((p) => p.r > 0);
}

/** Whether a character is drawn as a heavy cat: Cat theme on, and its conversation
 *  title or its zone is one of the heavy names. */
export function isCatHeavy(ch: Pick<Character, 'title' | 'zone'>): boolean {
  if (!isCatBehaviour() || names.size === 0) return false;
  const title = ch.title?.trim().toLowerCase();
  const zone = ch.zone?.trim().toLowerCase();
  return (!!title && names.has(title)) || (!!zone && names.has(zone));
}
