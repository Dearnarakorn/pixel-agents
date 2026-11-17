/**
 * The office theme's furniture art: while a theme is on, a furniture type it
 * redraws (a painting, a bin, a plant) is drawn with the theme's sprite in
 * place of the catalog's. Only the picture changes -- footprint, seats,
 * walkability and z-order still come from the catalog entry, and the saved
 * layout is never touched -- so a theme sprite must be the catalog sprite's
 * exact size (one that is not is ignored). DOM-free; the art is decoded and
 * handed in by officeTheme.ts.
 */

import type { SpriteData } from '../types.js';

let sprites: ReadonlyMap<string, SpriteData> | null = null;
let version = 0;

/** Set the theme's sprites by furniture type, or null for the catalog's own art. */
export function setThemeFurniture(next: ReadonlyMap<string, SpriteData> | null): void {
  sprites = next;
  version++;
}

/** Bumped on every change, so the office knows to rebuild its furniture. */
export function themeFurnitureVersion(): number {
  return version;
}

/** The sprite to draw for `type`: the theme's when it has one of the same size, else `catalog`. */
export function themedSprite(type: string, catalog: SpriteData): SpriteData {
  // A mirrored variant ('SOFA_SIDE:left') draws its base type's art, flipped by the renderer.
  const themed = sprites?.get(type) ?? sprites?.get(type.split(':')[0]);
  if (!themed || themed.length !== catalog.length || themed[0]?.length !== catalog[0]?.length) {
    return catalog;
  }
  return themed;
}
