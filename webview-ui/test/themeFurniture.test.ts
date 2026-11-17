import assert from 'node:assert/strict';

import { test } from 'vitest';

import { setThemeFurniture, themeArtKey, themedSprite } from '../src/office/layout/themeFurniture.js';
import type { SpriteData } from '../src/office/types.js';

const sprite = (fill: string): SpriteData => [[fill, fill]];

test('an item wears one variant of its type, the same one on every frame', () => {
  setThemeFurniture(
    new Map([
      ['PC_ON_1', sprite('base1')],
      ['PC_ON_1.fish', sprite('fish1')],
      ['PC_ON_1.blocks', sprite('blocks1')],
      ['PC_ON_2.fish', sprite('fish2')],
      ['PC_ON_2.blocks', sprite('blocks2')],
    ]),
  );
  const catalog = sprite('catalog');
  const uids = Array.from({ length: 20 }, (_, i) => `f-${i}`);
  const seen = new Set<string>();
  for (const uid of uids) {
    const one = themedSprite('PC_ON_1', catalog, uid)[0][0];
    const two = themedSprite('PC_ON_2', catalog, uid)[0][0];
    assert.equal(one.replace('1', ''), two.replace('2', ''));
    seen.add(one);
  }
  assert.deepEqual([...seen].sort(), ['blocks1', 'fish1']);
  // no uid: the type's own art; a type without variants is unchanged
  assert.equal(themedSprite('PC_ON_1', catalog)[0][0], 'base1');
  assert.equal(themeArtKey('BIN', 'f-1'), 'BIN');
  setThemeFurniture(null);
  assert.equal(themedSprite('PC_ON_1', catalog, 'f-1'), catalog);
});
