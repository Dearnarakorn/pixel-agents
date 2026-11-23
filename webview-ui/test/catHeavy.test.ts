import assert from 'node:assert/strict';

import { afterEach, test } from 'vitest';

import {
  CAT_HEAVY_DEFAULT_NAMES,
  CAT_HEAVY_WALK_SPEED_MUL,
  CAT_POOF_SEC,
} from '../src/constants.js';
import { setCatBehaviour } from '../src/office/engine/catBehaviour.js';
import {
  catHeavyPace,
  catPoofProgress,
  catPoofPuffs,
  getCatHeavyNames,
  isCatHeavy,
  setCatHeavyNames,
  tickCatShape,
} from '../src/office/engine/catHeavy.js';
import { getCharacterSprites, setCharacterTemplates } from '../src/office/sprites/spriteData.js';
import { Direction } from '../src/office/types.js';

/** A row of `n` one-pixel frames, frame i coloured `<tag><i>`. */
const row = (n: number, tag: string) => Array.from({ length: n }, (_, i) => [[`${tag}${i}`]]);
const sheet = (tag: string) => ({ down: row(10, tag), up: row(10, tag), right: row(10, tag) });

afterEach(() => {
  setCatBehaviour(false);
  setCatHeavyNames(CAT_HEAVY_DEFAULT_NAMES);
});

test('a heavy cat waddles slower than a slim one', () => {
  assert.equal(catHeavyPace({}), 1);
  assert.equal(catHeavyPace({ catHeavyShown: false }), 1);
  assert.equal(catHeavyPace({ catHeavyShown: true }), CAT_HEAVY_WALK_SPEED_MUL);
  assert.ok(CAT_HEAVY_WALK_SPEED_MUL > 0 && CAT_HEAVY_WALK_SPEED_MUL < 1);
});

test('the Boss is the fat cat (by title or zone); everyone else, and people, are not', () => {
  assert.equal(isCatHeavy({ title: 'Boss' }), false); // Office theme
  setCatBehaviour(true);
  assert.equal(isCatHeavy({ title: 'Boss' }), true);
  assert.equal(isCatHeavy({ title: '  boss ' }), true);
  assert.equal(isCatHeavy({ title: 'Engineer', zone: 'Boss' }), true);
  assert.equal(isCatHeavy({ title: 'Engineer', zone: 'Secretary' }), false);
  assert.equal(isCatHeavy({}), false);
});

test('the names are a comma list; empty means no fat cat', () => {
  setCatBehaviour(true);
  setCatHeavyNames('Boss, Engineer');
  assert.equal(getCatHeavyNames(), 'Boss, Engineer');
  assert.equal(isCatHeavy({ title: 'engineer' }), true);
  setCatHeavyNames(' , ');
  assert.equal(isCatHeavy({ title: 'Boss' }), false);
});

test('the shape changes behind a puff: halfway through, never on the first look', () => {
  setCatBehaviour(true);
  const ch: Parameters<typeof tickCatShape>[0] = { title: 'Boss' };
  tickCatShape(ch, 0.016); // first look: heavy at once, no puff
  assert.equal(ch.catHeavyShown, true);
  assert.equal(catPoofProgress(ch), null);

  ch.title = 'Boss (handed over)'; // renamed: slim again, behind a puff
  tickCatShape(ch, 0.016);
  assert.equal(ch.catPoofSec, CAT_POOF_SEC);
  assert.equal(ch.catHeavyShown, true);
  tickCatShape(ch, CAT_POOF_SEC * 0.4);
  assert.equal(ch.catHeavyShown, true); // still before halfway
  tickCatShape(ch, CAT_POOF_SEC * 0.2);
  assert.equal(ch.catHeavyShown, false); // swapped at halfway
  tickCatShape(ch, CAT_POOF_SEC);
  assert.equal(catPoofProgress(ch), null);

  setCatBehaviour(false); // the Office theme: no shape at all
  tickCatShape(ch, 0.016);
  assert.equal(ch.catHeavyShown, undefined);
});

test('the puff covers the cat halfway and is gone at the end', () => {
  const mid = catPoofPuffs(0.5);
  assert.ok(Math.max(...mid.map((p) => p.r)) >= 6);
  assert.equal(catPoofPuffs(1).length, 0);
  for (const p of catPoofPuffs(0.25)) assert.ok(Number.isInteger(p.dx) && Number.isInteger(p.r));
});

test("heavy picks the coat's heavy sheet (shut-eyed too); a coat without one stays slim", () => {
  setCharacterTemplates([sheet('#s'), sheet('#p')], (palette, _repeat, blink, heavy) => {
    if (palette === 1 || !heavy) return null;
    return blink ? sheet('#hb') : sheet('#h');
  });
  assert.deepEqual(getCharacterSprites(0, 0, false, true).walk[Direction.DOWN][0], [['#h0']]);
  assert.deepEqual(getCharacterSprites(0, 0, true, true).walk[Direction.DOWN][0], [['#hb0']]);
  assert.deepEqual(getCharacterSprites(0, 0, false, false).walk[Direction.DOWN][0], [['#s0']]);
  assert.deepEqual(getCharacterSprites(1, 0, false, true).walk[Direction.DOWN][0], [['#p0']]);
});
