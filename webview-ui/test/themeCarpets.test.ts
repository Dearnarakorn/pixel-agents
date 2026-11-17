import assert from 'node:assert/strict';

import { test } from 'vitest';

import {
  getCarpetJunctionSprite,
  setCarpetSprites,
  setThemeCarpets,
} from '../src/office/sprites/carpetTiles.js';
import type { CarpetTile, SpriteData } from '../src/office/types.js';

const DARK = '#646464';
const LIGHT = '#c4c4c4';
const fill = (hex: string): SpriteData => Array.from({ length: 16 }, () => Array(16).fill(hex));

test('a theme carpet piece is drawn in place of its case, in the carpet colours', () => {
  const set = Array.from({ length: 16 }, () => fill(DARK));
  set[1] = fill(LIGHT); // so the variant has both greys
  setCarpetSprites([set]);
  // a 2x2 carpet: the junction between its four tiles is case 15
  const tile: CarpetTile = { variant: 0 } as CarpetTile;
  const tiles = [tile, tile, tile, tile];
  const usual = getCarpetJunctionSprite(1, 1, 0, tiles, 2, 2);
  const paw = fill(DARK);
  paw[0][0] = LIGHT;
  setThemeCarpets(new Map([['0:15', paw]]));
  const themed = getCarpetJunctionSprite(1, 1, 0, tiles, 2, 2);
  assert.ok(usual && themed);
  assert.notEqual(themed[0][0], usual[0][0]); // the accent pixel shows
  assert.equal(themed[5][5], usual[5][5]); // the rest is the carpet colour
  setThemeCarpets(null);
  assert.equal(getCarpetJunctionSprite(1, 1, 0, tiles, 2, 2)?.[0][0], usual[0][0]);
});
