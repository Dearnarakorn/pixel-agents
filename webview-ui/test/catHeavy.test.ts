import assert from 'node:assert/strict';

import { afterEach, test } from 'vitest';

import { CAT_HEAVY_DEFAULT_PCT, CAT_HEAVY_MIN_PCT, CAT_HEAVY_OFF_PCT } from '../src/constants.js';
import { setCatBehaviour } from '../src/office/engine/catBehaviour.js';
import {
  clampCatHeavyPct,
  getCatHeavyThresholdPct,
  isCatHeavy,
  setCatHeavyThresholdPct,
} from '../src/office/engine/catHeavy.js';
import { getCharacterSprites, setCharacterTemplates } from '../src/office/sprites/spriteData.js';
import { Direction } from '../src/office/types.js';

/** A row of `n` one-pixel frames, frame i coloured `<tag><i>`. */
const row = (n: number, tag: string) => Array.from({ length: n }, (_, i) => [[`${tag}${i}`]]);
const sheet = (tag: string) => ({ down: row(10, tag), up: row(10, tag), right: row(10, tag) });
const used = (share: number) => ({ contextTokens: share * 1000, maxContextTokens: 1000 });

afterEach(() => {
  setCatBehaviour(false);
  setCatHeavyThresholdPct(CAT_HEAVY_DEFAULT_PCT);
});

test('a cat turns heavy at the threshold, not before; people never do', () => {
  setCatHeavyThresholdPct(60);
  assert.equal(isCatHeavy(used(0.9)), false); // Office theme
  setCatBehaviour(true);
  assert.equal(isCatHeavy(used(0.59)), false);
  assert.equal(isCatHeavy(used(0.6)), true);
  assert.equal(isCatHeavy(used(1)), true);
});

test('no context yet (a sub-agent, a fresh session) stays slim; the top of the range is off', () => {
  setCatBehaviour(true);
  setCatHeavyThresholdPct(CAT_HEAVY_MIN_PCT);
  assert.equal(isCatHeavy(used(0)), false);
  assert.equal(isCatHeavy({ contextTokens: 500, maxContextTokens: 0 }), false);
  setCatHeavyThresholdPct(CAT_HEAVY_OFF_PCT);
  assert.equal(isCatHeavy(used(1)), false);
});

test('a stored threshold is clamped to the slider and rounded; junk is the default', () => {
  assert.equal(clampCatHeavyPct(5), CAT_HEAVY_MIN_PCT);
  assert.equal(clampCatHeavyPct(250), CAT_HEAVY_OFF_PCT);
  assert.equal(clampCatHeavyPct(62.4), 62);
  assert.equal(clampCatHeavyPct(Number.NaN), CAT_HEAVY_DEFAULT_PCT);
  setCatHeavyThresholdPct(55);
  assert.equal(getCatHeavyThresholdPct(), 55);
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
