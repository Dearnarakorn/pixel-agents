/**
 * How work handed between sessions shows in this browser (localStorage, like the
 * Fat Cat names): the mode and the note timeout, read once at startup into
 * office/engine/mail.ts, written by Settings. Storage can be missing or refuse
 * (a private window): then the defaults hold, or the choice lasts for this page.
 */

import {
  MAIL_MODE_STORAGE_KEY,
  MAIL_NOTE_TIMEOUT_DEFAULT_MIN,
  MAIL_TIMEOUT_STORAGE_KEY,
} from '../constants.js';
import {
  MAIL_MODES,
  type MailMode,
  setMailMode,
  setMailNoteTimeoutMin,
} from '../office/engine/mail.js';

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null; // storage unavailable: the default
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // storage unavailable: the choice lasts for this page only
  }
}

export function readStoredMailMode(): MailMode {
  const raw = read(MAIL_MODE_STORAGE_KEY);
  return MAIL_MODES.find((m) => m === raw) ?? 'carry';
}

export function readStoredMailTimeoutMin(): number {
  const n = Number(read(MAIL_TIMEOUT_STORAGE_KEY));
  return Number.isFinite(n) && n > 0 ? n : MAIL_NOTE_TIMEOUT_DEFAULT_MIN;
}

export function storeMailMode(mode: MailMode): void {
  setMailMode(mode);
  write(MAIL_MODE_STORAGE_KEY, mode);
}

export function storeMailTimeoutMin(min: number): void {
  setMailNoteTimeoutMin(min);
  write(MAIL_TIMEOUT_STORAGE_KEY, String(min));
}

/** Apply the stored choices (once, at startup). */
export function initMailSetting(): void {
  setMailMode(readStoredMailMode());
  setMailNoteTimeoutMin(readStoredMailTimeoutMin());
}
