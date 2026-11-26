import assert from 'node:assert/strict';

import { test } from 'vitest';

import { createCharacter, updateCharacter } from '../src/office/engine/characters.js';
import type { Seat, TileType as TileTypeVal } from '../src/office/types.js';
import { CharacterState, Direction, TileType } from '../src/office/types.js';

// A 6 x 6 open floor with one chair at (2, 2) facing up.
const tileMap: TileTypeVal[][] = Array.from({ length: 6 }, () =>
  Array.from({ length: 6 }, () => TileType.FLOOR_1 as TileTypeVal),
);
const seat = {
  uid: 'chair',
  seatCol: 2,
  seatRow: 2,
  facingDir: Direction.UP,
  assigned: true,
} as unknown as Seat;
const seats = new Map([['chair', seat]]);
const walkable = tileMap.flatMap((r, row) => r.map((_, col) => ({ col, row })));

function run(ch: ReturnType<typeof createCharacter>, sec: number): void {
  for (let t = 0; t < sec; t += 0.1) updateCharacter(ch, 0.1, walkable, seats, tileMap, new Set());
}

test('an idle team member stays in its chair', () => {
  const ch = createCharacter(1, 0, 'chair', seat);
  ch.isActive = false;
  ch.stayAtDesk = true;
  ch.state = CharacterState.TYPE;
  ch.seatTimer = 0;
  run(ch, 120);
  assert.equal(ch.state, CharacterState.TYPE);
  assert.deepEqual([ch.tileCol, ch.tileRow], [2, 2]);
});

test('an idle team member away from its desk walks back and sits', () => {
  const ch = createCharacter(2, 0, 'chair', seat);
  ch.isActive = false;
  ch.stayAtDesk = true;
  ch.state = CharacterState.IDLE;
  ch.tileCol = 5;
  ch.tileRow = 5;
  ch.x = 5 * 16 + 8;
  ch.y = 5 * 16 + 8;
  run(ch, 30);
  assert.deepEqual([ch.tileCol, ch.tileRow], [2, 2]);
  assert.equal(ch.state, CharacterState.TYPE);
});

test('without a team desk an idle agent still gets up and wanders', () => {
  const ch = createCharacter(3, 0, 'chair', seat);
  ch.isActive = false;
  ch.state = CharacterState.TYPE;
  ch.seatTimer = 0;
  let leftChair = false;
  for (let t = 0; t < 120 && !leftChair; t += 0.1) {
    updateCharacter(ch, 0.1, walkable, seats, tileMap, new Set());
    leftChair = ch.state !== CharacterState.TYPE;
  }
  assert.ok(leftChair);
});
