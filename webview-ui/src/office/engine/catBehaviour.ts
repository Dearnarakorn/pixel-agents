/**
 * The Cat theme's idle behaviour: an idle cat, when a wander pause ends, may
 * run an errand instead of walking to a random tile -- go and sit by a toy, a
 * cat tree, its bowl or the window (tail swishing), nap where it is, sit a
 * moment, or dash about (zoomies). It uses only frames the cat sheets already
 * have (walk, the front/back sit with its tail swish, the seated frame, eyes
 * shut); side-on sits are never chosen. People (the Office theme) are
 * untouched: the flag is set by officeTheme.ts. DOM-free.
 */

import {
  CAT_ERRAND_CHANCE,
  CAT_INTEREST_TYPES,
  CAT_SPOT_NEAREST,
} from '../../constants.js';
import type { Character, PlacedFurniture } from '../types.js';
import { Direction } from '../types.js';

let catBehaviour = false;

/** Turn cat errands on (Cat theme) or off. */
export function setCatBehaviour(on: boolean): void {
  catBehaviour = on;
}

export function isCatBehaviour(): boolean {
  return catBehaviour;
}

export interface CatSpot {
  col: number;
  row: number;
  /** The way a cat sitting here faces: towards the thing, front or back only. */
  dir: Direction;
}

type Footprint = { footprintW: number; footprintH: number; canPlaceOnWalls?: boolean };

const INTEREST = new Set(CAT_INTEREST_TYPES);

/**
 * The floor tiles beside each interesting piece of furniture, and which way a
 * cat sitting there faces. A wall piece (the window) is looked at from the
 * floor tile under it. Side neighbours face down (the cat sits beside it,
 * looking out), since side-on sitting frames are not used.
 */
export function catSpots(
  furniture: readonly PlacedFurniture[],
  footprintOf: (type: string) => Footprint | undefined,
  walkable: (col: number, row: number) => boolean,
): CatSpot[] {
  const spots = new Map<string, CatSpot>();
  const add = (col: number, row: number, dir: Direction) => {
    const key = `${col},${row}`;
    if (!spots.has(key) && walkable(col, row)) spots.set(key, { col, row, dir });
  };
  for (const item of furniture) {
    if (!INTEREST.has(item.type)) continue;
    const fp = footprintOf(item.type);
    if (!fp) continue;
    const { col, row } = item;
    const bottom = row + fp.footprintH;
    for (let c = col; c < col + fp.footprintW; c++) {
      add(c, bottom, Direction.UP); // below it, looking up at it
      if (!fp.canPlaceOnWalls) add(c, row - 1, Direction.DOWN); // above it, looking down over it
    }
    if (!fp.canPlaceOnWalls) {
      for (let r = row; r < bottom; r++) {
        add(col - 1, r, Direction.DOWN);
        add(col + fp.footprintW, r, Direction.DOWN);
      }
    }
  }
  return [...spots.values()];
}

export type CatErrand = 'spot' | 'nap' | 'sit' | 'zoom' | 'wander';

/** Which errand a cat runs when its wander pause ends. */
export function chooseCatErrand(rand: () => number = Math.random): CatErrand {
  let r = rand();
  for (const errand of ['spot', 'nap', 'sit', 'zoom'] as const) {
    if (r < CAT_ERRAND_CHANCE[errand]) return errand;
    r -= CAT_ERRAND_CHANCE[errand];
  }
  return 'wander';
}

/** A spot among the few nearest the cat (so it goes to things in its own room), or null. */
export function pickCatSpot(
  ch: Pick<Character, 'tileCol' | 'tileRow'>,
  spots: readonly CatSpot[],
  taken: (spot: CatSpot) => boolean,
  rand: () => number = Math.random,
): CatSpot | null {
  const near = spots
    .filter((s) => !(s.col === ch.tileCol && s.row === ch.tileRow) && !taken(s))
    .map((s) => ({ s, d: Math.abs(s.col - ch.tileCol) + Math.abs(s.row - ch.tileRow) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, CAT_SPOT_NEAREST);
  if (near.length === 0) return null;
  return near[Math.floor(rand() * near.length)].s;
}

/** Stop any errand (the cat got work, or the theme changed). */
export function clearCatErrand(ch: Character): void {
  if (ch.catNap) ch.blinkShut = 0;
  ch.catSitSec = 0;
  ch.catNap = false;
  ch.catSpot = null;
  ch.speedMul = 1;
}
