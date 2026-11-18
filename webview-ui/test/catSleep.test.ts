import assert from 'node:assert/strict';

import { test } from 'vitest';

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
