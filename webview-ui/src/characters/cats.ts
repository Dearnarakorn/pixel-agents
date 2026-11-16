/**
 * Cat Mode: every agent in the office drawn as a cat. The cats are finished
 * character sheets (cats/<coat>.png, eyes open, and cats/<coat>.blink.png,
 * eyes shut), in the office's sheet layout, drawn from the doll body's poses
 * by Task/_ref/make_cat_sheets.py, so a cat walks, types, reads and sits
 * where a person would. Only the office and its mug shots change: the
 * Characters view still edits the people, and switching Cat Mode off brings
 * them back. A per-browser preference, off by default.
 */

import { CAT_COAT_ORDER, CAT_MODE_STORAGE_KEY } from '../constants.js';
import { decodePng } from './loadWardrobe.js';
import { setOfficeCats } from './officeSprites.js';
import { decodeSheet } from './sheet.js';

/** './cats/ginger.png' → data URI (inlined, like the wardrobe, so canvases stay untainted). */
const pngs = import.meta.glob<string>('./cats/*.png', {
  eager: true,
  query: '?inline',
  import: 'default',
});

/** One coat's sheets: eyes open, and eyes shut for blinking. */
export interface CatSheets {
  open: Uint8ClampedArray;
  shut: Uint8ClampedArray;
}

let loading: Promise<CatSheets[]> | null = null;

async function decodeCoat(coat: string): Promise<CatSheets | null> {
  const open = pngs[`./cats/${coat}.png`];
  const shut = pngs[`./cats/${coat}.blink.png`];
  if (!open || !shut) return null;
  const [o, s] = await Promise.all([decodePng(open), decodePng(shut)]);
  const openSheet = decodeSheet(o);
  const shutSheet = decodeSheet(s);
  return openSheet && shutSheet ? { open: openSheet, shut: shutSheet } : null;
}

/** The coats, decoded once, in CAT_COAT_ORDER (a coat that fails to decode is left out). */
export function loadCats(): Promise<CatSheets[]> {
  loading ??= Promise.all(CAT_COAT_ORDER.map(decodeCoat)).then((coats) =>
    coats.filter((c): c is CatSheets => c !== null),
  );
  return loading;
}

function readPref(): boolean {
  try {
    return window.localStorage.getItem(CAT_MODE_STORAGE_KEY) === 'on';
  } catch {
    return false;
  }
}

let catMode = readPref();

/** Hand the office its cats (once decoded) or take them away. */
function applyCatMode(): void {
  if (!catMode) {
    setOfficeCats(null);
    return;
  }
  void loadCats().then((cats) => {
    if (catMode) setOfficeCats(cats);
  });
}

export function isCatMode(): boolean {
  return catMode;
}

/** Switch Cat Mode; the office redraws its agents once the coats are loaded. */
export function setCatMode(on: boolean): void {
  catMode = on;
  try {
    window.localStorage.setItem(CAT_MODE_STORAGE_KEY, on ? 'on' : 'off');
  } catch {
    // storage unavailable: the choice lasts for this page only
  }
  applyCatMode();
}

// A page opened with Cat Mode on starts with cats.
applyCatMode();
