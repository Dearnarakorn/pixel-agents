/**
 * The office theme: one look for every browser on the host, kept by the
 * server (settingsLoaded.officeTheme, officeThemeUpdated). `office` is the
 * usual office; `cat` draws every agent as a cat (characters/cats.ts) and
 * redraws some furniture with cat art (office/themes/cat/<TYPE>.png, made by
 * Task/_ref/make_cat_furniture.py, each the size of the catalog sprite it
 * replaces). The layout itself is the same in both.
 */

import { useSyncExternalStore } from 'react';

import { rgbaToHex } from '../../core/src/assets/colorUtils.js';
import { setCatMode } from './characters/cats.js';
import { decodePng } from './characters/loadWardrobe.js';
import { setCatBehaviour } from './office/engine/catBehaviour.js';
import { setThemeFurniture } from './office/layout/themeFurniture.js';
import type { SpriteData } from './office/types.js';

type OfficeTheme = 'office' | 'cat';

/** './office/themes/cat/BIN.png' → data URI (inlined so canvases stay untainted). */
const catArt = import.meta.glob<string>('./office/themes/cat/*.png', {
  eager: true,
  query: '?inline',
  import: 'default',
});

let catFurniture: Promise<Map<string, SpriteData>> | null = null;

function loadCatFurniture(): Promise<Map<string, SpriteData>> {
  catFurniture ??= Promise.all(
    Object.entries(catArt).map(async ([path, uri]) => {
      const type = path.slice(path.lastIndexOf('/') + 1, -'.png'.length);
      const img = await decodePng(uri);
      const sprite: SpriteData = [];
      for (let y = 0; y < img.height; y++) {
        const row: string[] = [];
        for (let x = 0; x < img.width; x++) {
          const i = (y * img.width + x) * 4;
          row.push(rgbaToHex(img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]));
        }
        sprite.push(row);
      }
      return [type, sprite] as const;
    }),
  ).then((entries) => new Map(entries));
  return catFurniture;
}

let theme: OfficeTheme = 'office';
const listeners = new Set<() => void>();

function getOfficeTheme(): OfficeTheme {
  return theme;
}

/** Show `next` (from the server, or optimistically from Settings). */
export function applyOfficeTheme(next: OfficeTheme): void {
  if (next === theme) return;
  theme = next;
  const cat = next === 'cat';
  setCatMode(cat);
  setCatBehaviour(cat);
  if (cat) {
    void loadCatFurniture().then((sprites) => {
      if (theme === 'cat') setThemeFurniture(sprites);
    });
  } else {
    setThemeFurniture(null);
  }
  for (const listener of listeners) listener();
}

/** A server value as a theme (anything unknown is the usual office). */
export function officeThemeFrom(value: unknown): OfficeTheme {
  return value === 'cat' ? 'cat' : 'office';
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The theme, for React (Settings). */
export function useOfficeTheme(): OfficeTheme {
  return useSyncExternalStore(subscribe, getOfficeTheme);
}
