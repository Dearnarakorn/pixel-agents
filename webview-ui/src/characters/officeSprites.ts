/**
 * The office wears the cast: profile N is palette N, followed by any char_N.png sprites
 * from external asset directories. Follows the cast store as a subscriber; the store
 * doesn't know about the office. A repeated character's sheet (repeatClothes.ts) is
 * rendered on demand: a profile's with its clothes recoloured, an external sprite
 * hue-turned whole.
 */

import { sheetToDirectionSprites } from '../../../core/src/assets/characterSheet.js';
import { SHEET_FRAMES } from '../../../core/src/assets/seatedFrame.js';
import type { CharacterDirectionSprites } from '../../../core/src/assets/types.js';
import type { CharacterProfile } from '../../../core/src/characterProfiles.js';
import { CAST_OFFICE_SYNC_MS } from '../constants.js';
import { adjustSprite } from '../office/colorize.js';
import { setCharacterTemplates } from '../office/sprites/spriteData.js';
import type { CastState } from './cast.js';
import { isCatMode, loadCats, loadedCats, subscribeCatMode } from './cats.js';
import type { CharacterRenderer } from './renderer.js';
import { repeatHueTurn, withRepeatClothes } from './repeatClothes.js';
import { SHEET_W } from './sheet.js';
import { canBlink } from './slots.js';

/** A composed 128x96 character sheet as the office's per-direction frame sprites. */
export function sheetToOfficeSprites(sheet: Uint8ClampedArray): CharacterDirectionSprites {
  return sheetToDirectionSprites(sheet, SHEET_W);
}

interface CastSource {
  subscribe: (listener: () => void) => () => void;
  getState: () => CastState;
}

/** The reading frames in a sheet row. */
const READ_FRAMES = new Set<number>(SHEET_FRAMES.read);

/** Each sheet's office sprites, converted once (sheets are cached, immutable buffers). */
const converted = new WeakMap<Uint8ClampedArray, CharacterDirectionSprites>();
let external: CharacterDirectionSprites[] = [];
let source: CastSource | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
/** Whether the office has had the cast yet (until then, sync at once). */
let synced = false;

/** A sheet's office sprites, converted once per sheet. */
function officeSpritesOf(sheet: Uint8ClampedArray): CharacterDirectionSprites {
  let set = converted.get(sheet);
  if (!set) {
    set = sheetToOfficeSprites(sheet);
    converted.set(sheet, set);
  }
  return set;
}

/** Reading frames (5, 6 of each row) from `open`, the rest from `shut`. */
function withOpenReading(
  shut: CharacterDirectionSprites,
  open: CharacterDirectionSprites,
): CharacterDirectionSprites {
  const mix = (s: string[][][], o: string[][][]) =>
    s.map((f, i) => (READ_FRAMES.has(i) ? o[i] : f));
  return {
    down: mix(shut.down, open.down),
    up: mix(shut.up, open.up),
    right: mix(shut.right, open.right),
  };
}

/** An external sprite hue-turned whole for its repeat (repeatHueTurn). */
function hueTurned(sprites: CharacterDirectionSprites, repeat: number): CharacterDirectionSprites {
  const shift = { h: repeatHueTurn(repeat), s: 0, b: 0, c: 0 };
  const turn = (frames: string[][][]) => frames.map((frame) => adjustSprite(frame, shift));
  return { down: turn(sprites.down), up: turn(sprites.up), right: turn(sprites.right) };
}

/** `worn`'s sprites with the eyes shut, or null when `profile` can't blink. */
function blinkSprites(
  renderer: CharacterRenderer,
  profile: CharacterProfile,
  worn: CharacterProfile,
): CharacterDirectionSprites | null {
  if (!canBlink(profile, false)) return null;
  const shut = officeSpritesOf(renderer.sheet({ ...worn, blink: true }));
  if (canBlink(profile, true)) return shut;
  // Bare eyes keep their reading frames open: a blink there would flash the glasses.
  return withOpenReading(shut, officeSpritesOf(renderer.sheet(worn)));
}

/** A step through the coats per repeat, so two copies of a character wear different cats. */
const CAT_REPEAT_STEP = 3;

/**
 * Cat Mode: every palette (profiles, then external sprites) wears a coat by
 * its index, a repeat steps to another coat, a blink shuts the cat's eyes.
 * False while the coats are still loading (the people stay until then).
 */
function syncCats(count: number): boolean {
  const cats = loadedCats();
  if (!cats.length) {
    void loadCats().then(() => schedule(0));
    return false;
  }
  const coat = (palette: number, repeat: number) =>
    cats[(palette + repeat * CAT_REPEAT_STEP) % cats.length];
  const sprites = Array.from({ length: count }, (_, i) => officeSpritesOf(coat(i, 0).open));
  setCharacterTemplates(sprites, (palette, repeat, blink) => {
    const c = coat(palette, repeat);
    return officeSpritesOf(blink ? c.shut : c.open);
  });
  return true;
}

function sync(): void {
  timer = null;
  if (!source) return;
  const { renderer, profiles } = source.getState();
  if (!renderer || !profiles.length) return;
  if (isCatMode() && syncCats(profiles.length + external.length)) {
    synced = true;
    return;
  }
  const sprites = profiles.map((p) => officeSpritesOf(renderer.sheet(p)));
  // The repeats are drawn from this same cast, so they never fall out of step.
  setCharacterTemplates([...sprites, ...external], (palette, repeat, blink) => {
    const profile = profiles[palette];
    if (profile) {
      const worn = repeat ? withRepeatClothes(profile, repeat) : profile;
      return blink ? blinkSprites(renderer, profile, worn) : officeSpritesOf(renderer.sheet(worn));
    }
    // External char_N.png sprites have no eyes to shut.
    const sprite = blink ? null : external[palette - profiles.length];
    return sprite ? hueTurned(sprite, repeat) : null;
  });
  synced = true;
}

/** Sync after `delay` ms, coalescing with one already scheduled. */
function schedule(delay: number): void {
  if (!timer) timer = setTimeout(sync, delay);
}

/**
 * Keep the office's character sprites in step with the cast: at once for the first cast,
 * then at most every CAST_OFFICE_SYNC_MS while it changes (a drag re-renders often).
 * Returns the unsubscribe.
 */
export function startOfficeSync(cast: CastSource): () => void {
  source = cast;
  let { renderer, profiles } = cast.getState();
  sync();
  const unsubscribe = cast.subscribe(() => {
    const state = cast.getState();
    if (state.renderer === renderer && state.profiles === profiles) return;
    ({ renderer, profiles } = state);
    schedule(synced ? CAST_OFFICE_SYNC_MS : 0);
  });
  const unsubscribeCats = subscribeCatMode(() => schedule(0));
  return () => {
    unsubscribe();
    unsubscribeCats();
    if (timer) clearTimeout(timer);
    timer = null;
    if (source === cast) source = null;
  };
}

/** External asset directories' char_N.png, worn after the profiles. */
export function setExternalCharacterSprites(sprites: CharacterDirectionSprites[]): void {
  external = sprites;
  schedule(0);
}
