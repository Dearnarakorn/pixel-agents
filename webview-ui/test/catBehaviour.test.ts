import assert from 'node:assert/strict';

import { test } from 'vitest';

import { CAT_ERRAND_CHANCE } from '../src/constants.js';
import {
  catSideSitZ,
  catSitDir,
  catSitsOnFloor,
  catSpots,
  chooseCatErrand,
  clearCatErrand,
  pickCatSpot,
  setCatBehaviour,
} from '../src/office/engine/catBehaviour.js';
import type { Character, PlacedFurniture } from '../src/office/types.js';
import { CharacterState, Direction } from '../src/office/types.js';

const footprints: Record<string, { footprintW: number; footprintH: number; canPlaceOnWalls?: boolean }> = {
  POT: { footprintW: 1, footprintH: 1 },
  WHITEBOARD: { footprintW: 2, footprintH: 2, canPlaceOnWalls: true },
  DESK_FRONT: { footprintW: 3, footprintH: 2 },
};
const item = (type: string, col: number, row: number): PlacedFurniture =>
  ({ uid: `${type}-${col}-${row}`, type, col, row }) as PlacedFurniture;
const everywhere = () => true;

test('a floor toy gets spots on all four sides; side spots face down, not sideways', () => {
  const spots = catSpots([item('POT', 5, 5)], (t) => footprints[t], everywhere);
  const at = (col: number, row: number) => spots.find((s) => s.col === col && s.row === row);
  assert.equal(at(5, 6)?.dir, Direction.UP); // below, looking up at it
  assert.equal(at(5, 4)?.dir, Direction.DOWN); // above, looking down over it
  assert.equal(at(4, 5)?.dir, Direction.DOWN);
  assert.equal(at(6, 5)?.dir, Direction.DOWN);
  assert.equal(spots.length, 4);
  assert.ok(spots.every((s) => s.dir === Direction.UP || s.dir === Direction.DOWN));
});

test('a window is looked at from the floor under it only', () => {
  const spots = catSpots([item('WHITEBOARD', 10, 0)], (t) => footprints[t], everywhere);
  assert.deepEqual(
    spots.map((s) => [s.col, s.row, s.dir]),
    [
      [10, 2, Direction.UP],
      [11, 2, Direction.UP],
    ],
  );
});

test('furniture cats ignore, and unwalkable tiles, give no spots', () => {
  assert.equal(catSpots([item('DESK_FRONT', 1, 1)], (t) => footprints[t], everywhere).length, 0);
  assert.equal(catSpots([item('POT', 5, 5)], (t) => footprints[t], () => false).length, 0);
});

test('errands come in their set proportions, the rest ordinary wanders', () => {
  assert.equal(chooseCatErrand(() => 0), 'spot');
  assert.equal(chooseCatErrand(() => CAT_ERRAND_CHANCE.spot + 0.001), 'nap');
  assert.equal(chooseCatErrand(() => 0.999), 'wander');
});

test('a cat picks a spot near it that no one holds', () => {
  const spots = [
    { col: 1, row: 1, dir: Direction.UP },
    { col: 30, row: 30, dir: Direction.UP },
    { col: 2, row: 1, dir: Direction.DOWN },
  ];
  const ch = { tileCol: 1, tileRow: 2 };
  const taken = (s: { col: number }) => s.col === 1;
  const got = pickCatSpot(ch, spots, taken, () => 0);
  assert.deepEqual(got, spots[2]);
  assert.equal(pickCatSpot(ch, spots, () => true), null);
});

test('a pausing cat sits facing front or back, never side-on; people do not sit', () => {
  assert.equal(catSitDir(Direction.LEFT), Direction.DOWN);
  assert.equal(catSitDir(Direction.RIGHT), Direction.DOWN);
  assert.equal(catSitDir(Direction.UP), Direction.UP);
  const idle = { state: CharacterState.IDLE, catSitSec: 0 };
  setCatBehaviour(false);
  assert.equal(catSitsOnFloor(idle), false);
  setCatBehaviour(true);
  assert.equal(catSitsOnFloor(idle), true);
  assert.equal(catSitsOnFloor({ state: CharacterState.WALK, catSitSec: 0 }), false);
  setCatBehaviour(false);
});

test('a side-seated cat sorts in front of the table it reaches over, nothing else does', () => {
  // cat seated at x 24 (tile 1), facing right; a 2-tile-wide table from x 32, rows 1-3, z 64
  const table = { x: 32, y: 16, zY: 64, sprite: Array.from({ length: 48 }, () => Array(32).fill('')) };
  const lamp = { x: 64, y: 0, zY: 64, sprite: [Array(16).fill('')] }; // out of reach
  const typing = { state: CharacterState.TYPE, dir: Direction.RIGHT, x: 24 };
  setCatBehaviour(true);
  assert.equal(catSideSitZ(typing, 32.5, 6, 38, [table, lamp]), 64.25);
  assert.equal(catSideSitZ({ ...typing, dir: Direction.LEFT }, 32.5, 6, 38, [table]), 32.5);
  assert.equal(catSideSitZ({ ...typing, dir: Direction.DOWN }, 32.5, 6, 38, [table]), 32.5);
  setCatBehaviour(false);
  assert.equal(catSideSitZ(typing, 32.5, 6, 38, [table]), 32.5);
});

test('clearing an errand opens a napping cat\'s eyes and stops its dash', () => {
  const ch = { catSitSec: 5, catNap: true, catSpot: null, speedMul: 2.6, blinkShut: 5 } as unknown as Character;
  clearCatErrand(ch);
  assert.equal(ch.catSitSec, 0);
  assert.equal(ch.catNap, false);
  assert.equal(ch.blinkShut, 0);
  assert.equal(ch.speedMul, 1);
});
