import assert from 'node:assert/strict';

import { test } from 'vitest';

import { CAT_SIDE_SEAT_SINK_PX } from '../src/constants.js';
import { catSideSeatSink, setCatBehaviour } from '../src/office/engine/catBehaviour.js';
import { createCharacter, getCharacterSprite } from '../src/office/engine/characters.js';
import { getCharacterSprites, setCharacterTemplates } from '../src/office/sprites/spriteData.js';
import { CharacterState, Direction } from '../src/office/types.js';

/** A row of `n` one-pixel frames, frame i coloured `#i`. */
const row = (n: number) => Array.from({ length: n }, (_, i) => [[`#${i}`]]);
const sheet = (n: number) => ({ down: row(n), up: row(n), right: row(n) });

test('a 10-frame sheet (a cat) gets sleeping frames 8 and 9; an 8-frame one (a person) none', () => {
  setCharacterTemplates([sheet(10), sheet(8)]);
  const cat = getCharacterSprites(0);
  assert.ok(cat.sleeping);
  assert.deepEqual(cat.sleeping[Direction.DOWN], [[['#8']], [['#9']]]);
  assert.equal(getCharacterSprites(1).sleeping, undefined);
});

test('a napping cat and a cat in bed draw the sleeping frames; a person in bed stays seated', () => {
  setCharacterTemplates([sheet(10), sheet(8)]);
  const nap = createCharacter(1, 0, null, null);
  nap.state = CharacterState.IDLE;
  nap.catSitSec = 10;
  nap.catNap = true;
  nap.dir = Direction.DOWN;
  nap.frame = 1;
  assert.deepEqual(getCharacterSprite(nap, getCharacterSprites(0)), [['#9']]);

  const bed = createCharacter(2, 0, null, null);
  bed.state = CharacterState.TYPE;
  bed.isActive = false;
  bed.inBed = true;
  bed.dir = Direction.DOWN;
  bed.frame = 0;
  assert.deepEqual(getCharacterSprite(bed, getCharacterSprites(0)), [['#8']]);
  assert.deepEqual(getCharacterSprite(bed, getCharacterSprites(1)), [['#7']]);
});

test('a cat resting in its seat swishes its tail (seated, then paws-down typing); a person stays still', () => {
  setCharacterTemplates([sheet(10)]);
  const ch = createCharacter(3, 0, null, null);
  ch.state = CharacterState.TYPE;
  ch.isActive = false;
  ch.dir = Direction.RIGHT;
  try {
    setCatBehaviour(true);
    ch.frame = 0;
    assert.deepEqual(getCharacterSprite(ch, getCharacterSprites(0)), [['#7']]);
    ch.frame = 1;
    assert.deepEqual(getCharacterSprite(ch, getCharacterSprites(0)), [['#4']]);
  } finally {
    setCatBehaviour(false);
  }
  assert.deepEqual(getCharacterSprite(ch, getCharacterSprites(0)), [['#7']]);
});

test('only a cat seated side-on sinks into its cushion', () => {
  try {
    setCatBehaviour(true);
    assert.equal(catSideSeatSink({ dir: Direction.LEFT, inBed: false }), CAT_SIDE_SEAT_SINK_PX);
    assert.equal(catSideSeatSink({ dir: Direction.RIGHT, inBed: false }), CAT_SIDE_SEAT_SINK_PX);
    assert.equal(catSideSeatSink({ dir: Direction.DOWN, inBed: false }), 0);
    assert.equal(catSideSeatSink({ dir: Direction.RIGHT, inBed: true }), 0);
  } finally {
    setCatBehaviour(false);
  }
  assert.equal(catSideSeatSink({ dir: Direction.LEFT, inBed: false }), 0);
});
