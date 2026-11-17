import assert from 'node:assert/strict';

import { test } from 'vitest';

import { CAT_TOY_SPACING } from '../src/constants.js';
import { placeCatToys } from '../src/office/layout/catToys.js';
import type { PlacedFurniture, TileType as TileTypeVal } from '../src/office/types.js';
import { TileType } from '../src/office/types.js';

// a 10x10 room: walls round the edge, floor inside
const cols = 10;
const rows = 10;
const tiles: TileTypeVal[] = Array.from({ length: cols * rows }, (_, i) => {
  const c = i % cols;
  const r = Math.floor(i / cols);
  return c === 0 || r === 0 || c === cols - 1 || r === rows - 1 ? TileType.WALL : TileType.FLOOR_1;
});
const layout = { cols, rows, tiles };
const sizes: Record<string, { footprintW: number; footprintH: number }> = {
  SOFA_FRONT: { footprintW: 2, footprintH: 1 },
  COFFEE_TABLE: { footprintW: 2, footprintH: 2 },
  DESK_FRONT: { footprintW: 3, footprintH: 2 },
};
const item = (type: string, col: number, row: number): PlacedFurniture =>
  ({ uid: `${type}-${col}-${row}`, type, col, row }) as PlacedFurniture;
const footprintOf = (type: string) => sizes[type.split(':')[0]];
const kinds = ['TOY.mouse', 'TOY.yarn'];

test('lounge furniture gets toys on free floor near it, apart, of the given kinds', () => {
  const furniture = [item('SOFA_FRONT', 4, 3), item('COFFEE_TABLE', 4, 5)];
  const toys = placeCatToys(layout, furniture, footprintOf, kinds);
  assert.ok(toys.length >= 1 && toys.length <= 2);
  for (const t of toys) {
    assert.ok(kinds.includes(t.kind));
    assert.ok(t.col > 0 && t.row > 0 && t.col < cols - 1 && t.row < rows - 1, 'on the floor');
    assert.ok(!(t.col >= 4 && t.col <= 5 && t.row >= 3 && t.row <= 6), 'not under furniture');
  }
  if (toys.length === 2) {
    const [a, b] = toys;
    assert.ok(Math.abs(a.col - b.col) > CAT_TOY_SPACING || Math.abs(a.row - b.row) > CAT_TOY_SPACING);
  }
  // the same layout puts them in the same places
  assert.deepEqual(placeCatToys(layout, furniture, footprintOf, kinds), toys);
});

test('no toys without toy art, and none by work furniture', () => {
  assert.deepEqual(placeCatToys(layout, [item('SOFA_FRONT', 4, 3)], footprintOf, []), []);
  assert.deepEqual(placeCatToys(layout, [item('DESK_FRONT', 4, 3)], footprintOf, kinds), []);
});
