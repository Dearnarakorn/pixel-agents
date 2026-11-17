import assert from 'node:assert/strict';

import { test } from 'vitest';

import { getColorizedFloorSprite, setFloorSprites, setThemeFloors } from '../src/office/floorTiles.js';
import type { SpriteData } from '../src/office/types.js';

const tile = (hex: string): SpriteData => Array.from({ length: 16 }, () => Array(16).fill(hex));
const grey = { h: 0, s: 0, b: 0, c: 0 };

test('a theme floor stands in for its pattern, and only while set', () => {
  setFloorSprites([tile('#808080'), tile('#808080')]);
  const usual = getColorizedFloorSprite(2, grey)[0][0];
  setThemeFloors(new Map([[2, tile('#ffffff')]]));
  const themed = getColorizedFloorSprite(2, grey)[0][0];
  assert.notEqual(themed, usual);
  assert.equal(getColorizedFloorSprite(1, grey)[0][0], usual); // other patterns unchanged
  setThemeFloors(new Map([[2, [['#ffffff']]]])); // wrong size: ignored
  assert.equal(getColorizedFloorSprite(2, grey)[0][0], usual);
  setThemeFloors(null);
  assert.equal(getColorizedFloorSprite(2, grey)[0][0], usual);
});
