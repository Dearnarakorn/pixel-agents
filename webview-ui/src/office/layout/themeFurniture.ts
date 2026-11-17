/**
 * The office theme's furniture art: while a theme is on, a furniture type it
 * redraws (a painting, a bin, a plant) is drawn with the theme's sprite in
 * place of the catalog's. Only the picture changes -- footprint, seats,
 * walkability and z-order still come from the catalog entry, and the saved
 * layout is never touched -- so a theme sprite must be the catalog sprite's
 * exact size (one that is not is ignored). DOM-free; the art is decoded and
 * handed in by officeTheme.ts.
 *
 * A type may come in variants, keyed `<TYPE>.<variant>` (a laptop's screen
 * showing one of several games): each placed item wears one of them, picked
 * by its uid, so it keeps the same one across frames and rebuilds.
 */

import type { SpriteData } from '../types.js';

let sprites: ReadonlyMap<string, SpriteData> | null = null;
/** Type → its variant keys, sorted (the same order for every frame of an animation). */
let variants = new Map<string, string[]>();
let version = 0;

/** Set the theme's sprites by furniture type, or null for the catalog's own art. */
export function setThemeFurniture(next: ReadonlyMap<string, SpriteData> | null): void {
  sprites = next;
  variants = new Map();
  for (const key of next?.keys() ?? []) {
    const dot = key.indexOf('.');
    if (dot < 0) continue;
    const type = key.slice(0, dot);
    variants.set(type, [...(variants.get(type) ?? []), key]);
  }
  for (const list of variants.values()) list.sort();
  version++;
}

/** Bumped on every change, so the office knows to rebuild its furniture. */
export function themeFurnitureVersion(): number {
  return version;
}

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

/** The theme art key an item of `type` wears: one of the type's variants (by `uid`), else the type. */
export function themeArtKey(type: string, uid?: string): string {
  if (uid === undefined) return type;
  const list = variants.get(type);
  return list && list.length > 0 ? list[hash(uid) % list.length] : type;
}

/** A type's variant keys (sorted), e.g. every 'TOY.<kind>' for 'TOY'; none without a theme. */
export function themeVariants(type: string): readonly string[] {
  return variants.get(type) ?? [];
}

/** The theme's sprite stored under `key` (a type or a variant key), if any. */
export function themeArt(key: string): SpriteData | undefined {
  return sprites?.get(key);
}

/** The sprite to draw for `type`: the theme's when it has one of the same size, else `catalog`. */
export function themedSprite(type: string, catalog: SpriteData, uid?: string): SpriteData {
  // A mirrored variant ('SOFA_SIDE:left') draws its base type's art, flipped by the renderer.
  const themed =
    sprites?.get(themeArtKey(type, uid)) ?? sprites?.get(type) ?? sprites?.get(type.split(':')[0]);
  if (!themed || themed.length !== catalog.length || themed[0]?.length !== catalog[0]?.length) {
    return catalog;
  }
  return themed;
}
