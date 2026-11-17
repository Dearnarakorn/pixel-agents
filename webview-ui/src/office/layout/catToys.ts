/**
 * The Cat theme's floor toys: a yarn ball, a toy mouse, a scratch mat... left
 * lying about the lounge. They are not in the layout (the Office theme never
 * shows them, and the saved layout is never touched): each piece of lounge
 * furniture (a sofa, the coffee table, a cat tree) gets one toy on a free floor
 * tile near it, picked by the tile's hash so it stays put across reloads. Toys
 * lie flat on the floor -- characters walk over them -- and idle cats go and
 * sit by them. DOM-free.
 */

import { CAT_TOY_ANCHOR_TYPES, CAT_TOY_REACH, CAT_TOY_SPACING } from '../../constants.js';
import type { PlacedFurniture, TileType as TileTypeVal } from '../types.js';
import { TileType } from '../types.js';

export interface CatToy {
  col: number;
  row: number;
  /** Which toy (one of the art keys passed in). */
  kind: string;
}

interface Footprint {
  footprintW: number;
  footprintH: number;
}

function tileHash(col: number, row: number): number {
  const x = (Math.imul(col, 73856093) ^ Math.imul(row, 19349663)) >>> 0;
  return (x ^ (x >>> 13)) >>> 0;
}

/** Where the toys lie, for a layout and the toy kinds the theme draws (none = no toys). */
export function placeCatToys(
  layout: { cols: number; rows: number; tiles: readonly TileTypeVal[] },
  furniture: readonly PlacedFurniture[],
  footprintOf: (type: string) => Footprint | undefined,
  kinds: readonly string[],
): CatToy[] {
  if (kinds.length === 0) return [];
  const occupied = new Set<string>();
  for (const f of furniture) {
    const fp = footprintOf(f.type);
    if (!fp) continue;
    for (let dr = 0; dr < fp.footprintH; dr++) {
      for (let dc = 0; dc < fp.footprintW; dc++) occupied.add(`${f.col + dc},${f.row + dr}`);
    }
  }
  const isFloor = (col: number, row: number) => {
    if (col < 0 || row < 0 || col >= layout.cols || row >= layout.rows) return false;
    const t = layout.tiles[row * layout.cols + col];
    return t !== TileType.WALL && t !== TileType.VOID;
  };
  const anchors = [...furniture]
    .filter((f) => CAT_TOY_ANCHOR_TYPES.includes(f.type.split(':')[0]))
    .sort((a, b) => a.row - b.row || a.col - b.col);
  const toys: CatToy[] = [];
  for (const f of anchors) {
    const fp = footprintOf(f.type);
    if (!fp) continue;
    let best: { hash: number; col: number; row: number } | null = null;
    for (let row = f.row - CAT_TOY_REACH; row < f.row + fp.footprintH + CAT_TOY_REACH; row++) {
      for (let col = f.col - CAT_TOY_REACH; col < f.col + fp.footprintW + CAT_TOY_REACH; col++) {
        if (!isFloor(col, row) || occupied.has(`${col},${row}`)) continue;
        if (toys.some((t) => Math.abs(t.col - col) <= CAT_TOY_SPACING && Math.abs(t.row - row) <= CAT_TOY_SPACING)) {
          continue;
        }
        const hash = tileHash(col, row);
        if (!best || hash < best.hash) best = { hash, col, row };
      }
    }
    if (best) toys.push({ col: best.col, row: best.row, kind: kinds[best.hash % kinds.length] });
  }
  return toys;
}
