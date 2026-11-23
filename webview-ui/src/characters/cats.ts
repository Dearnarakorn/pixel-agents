/**
 * The Cat theme's agents: every agent in the office drawn as a real
 * four-legged cat. Each coat is a finished sheet (cats/<coat>.png, eyes open,
 * and cats/<coat>.blink.png, eyes shut) recoloured from the pet cat:
 * 3 direction rows (down, up, right) x 10 frames (walk1-3, type1-2, read1-2,
 * seated like a person's sheet, then sleep1-2), every frame 32x32, since a cat seen
 * side-on is long (the office centres a sprite on its own width). Only the
 * office and its mug shots change: the Characters view still edits the
 * people, and the Office theme brings them back. Each coat also has a heavy
 * cat (cats/heavy/), worn by the boss: the agents named in Settings (catHeavy.ts).
 */

import { rgbaToHex } from '../../../core/src/assets/colorUtils.js';
import type { CharacterDirectionSprites } from '../../../core/src/assets/types.js';
import { CAT_COAT_ORDER, CAT_FRAME_PX } from '../constants.js';
import { initCatHeavySetting } from './catHeavySetting.js';
import { decodePng } from './loadWardrobe.js';
import { type OfficeCatSheets, setOfficeCats } from './officeSprites.js';

/** './cats/ginger.png' → data URI (inlined, like the wardrobe, so canvases stay untainted). */
const pngs = import.meta.glob<string>('./cats/*.png', {
  eager: true,
  query: '?inline',
  import: 'default',
});
/** The same coats as heavy cats ('./cats/heavy/ginger.png'), drawn by make_heavy_cat_sheets.py. */
const heavyPngs = import.meta.glob<string>('./cats/heavy/*.png', {
  eager: true,
  query: '?inline',
  import: 'default',
});

const DIRECTIONS = ['down', 'up', 'right'] as const;
/** A person's 8 frames, then sleep1-2 (curled up, breathing). */
const FRAMES_PER_ROW = 10;

/** A cat sheet's pixels as office sprites (32x32 frames), or null when it is the wrong size. */
function sheetToCatSprites(img: {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}): CharacterDirectionSprites | null {
  if (img.width !== CAT_FRAME_PX * FRAMES_PER_ROW || img.height !== CAT_FRAME_PX * DIRECTIONS.length) {
    return null;
  }
  const sprites: CharacterDirectionSprites = { down: [], up: [], right: [] };
  DIRECTIONS.forEach((dir, row) => {
    for (let f = 0; f < FRAMES_PER_ROW; f++) {
      const frame: string[][] = [];
      for (let y = 0; y < CAT_FRAME_PX; y++) {
        const line: string[] = [];
        for (let x = 0; x < CAT_FRAME_PX; x++) {
          const i = ((row * CAT_FRAME_PX + y) * img.width + f * CAT_FRAME_PX + x) * 4;
          line.push(rgbaToHex(img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]));
        }
        frame.push(line);
      }
      sprites[dir].push(frame);
    }
  });
  return sprites;
}

let loading: Promise<OfficeCatSheets[]> | null = null;

/** A coat's open- and shut-eyed sheets, or null when either is missing or the wrong size. */
async function decodePair(
  open: string | undefined,
  shut: string | undefined,
): Promise<{ open: CharacterDirectionSprites; shut: CharacterDirectionSprites } | null> {
  if (!open || !shut) return null;
  const [o, s] = await Promise.all([decodePng(open), decodePng(shut)]);
  const openSprites = sheetToCatSprites(o);
  const shutSprites = sheetToCatSprites(s);
  return openSprites && shutSprites ? { open: openSprites, shut: shutSprites } : null;
}

async function decodeCoat(coat: string): Promise<OfficeCatSheets | null> {
  const [slim, heavy] = await Promise.all([
    decodePair(pngs[`./cats/${coat}.png`], pngs[`./cats/${coat}.blink.png`]),
    decodePair(heavyPngs[`./cats/heavy/${coat}.png`], heavyPngs[`./cats/heavy/${coat}.blink.png`]),
  ]);
  if (!slim) return null;
  return heavy ? { ...slim, heavy } : slim;
}

/** The coats, decoded once, in CAT_COAT_ORDER (a coat that fails to decode is left out). */
export function loadCats(): Promise<OfficeCatSheets[]> {
  loading ??= Promise.all(CAT_COAT_ORDER.map(decodeCoat)).then((coats) =>
    coats.filter((c): c is OfficeCatSheets => c !== null),
  );
  return loading;
}

let catMode = false;

/** Draw the office's agents as cats or as people (the Cat theme, officeTheme.ts);
 *  the office redraws them once the coats are loaded. */
export function setCatMode(on: boolean): void {
  catMode = on;
  if (!on) {
    setOfficeCats(null);
    return;
  }
  initCatHeavySetting();
  void loadCats().then((cats) => {
    if (catMode) setOfficeCats(cats);
  });
}
