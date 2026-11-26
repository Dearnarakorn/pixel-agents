/**
 * Mail between sessions: one session's message to another (the server's
 * agentStatus `messageFrom` on the receiver's turn start) as office work that
 * changes hands, for every pair of sessions. DOM-free.
 *
 * The work cycle (mode 'carry', the default):
 *  - Assign: A's message to B. A's cat carries a note in A's colour to B's desk
 *    and walks back; B keeps working in its chair. The note lies on B's desk.
 *  - Return: B's message back to A. B's cat picks A's note up off its desk and
 *    carries it to A's desk, onto A's review tray.
 *  - Review: the tray's notes go when A's turn that read them ends.
 *  - Any note goes after the timeout (minutes, a setting), in case nobody answers.
 * A walker who is busy walking queues the errand; one with a long queue, asleep,
 * or not in the office hands the note over at once. Mode 'visit' has the
 * receiver walk to the sender instead; 'envelope' only flies an envelope.
 * Every mode lays the notes and flies the envelope when nobody walks.
 */

import {
  MAIL_ARC_PX,
  MAIL_DROP_PX,
  MAIL_FLIGHT_SEC,
  MAIL_HEAD_RISE_PX,
  MAIL_NOTE_COLORS,
  MAIL_NOTE_MIN_SEC,
  MAIL_NOTE_TIMEOUT_DEFAULT_MIN,
} from '../../constants.js';
import type { Character, DeskNote, Direction } from '../types.js';
import { Direction as Dir } from '../types.js';

/** How work changes hands in the office (Settings → Handing Over Work). */
export type MailMode = 'carry' | 'visit' | 'envelope';
export const MAIL_MODES: readonly MailMode[] = ['carry', 'visit', 'envelope'];

let mode: MailMode = 'carry';
let timeoutSec = MAIL_NOTE_TIMEOUT_DEFAULT_MIN * 60;

export function setMailMode(next: MailMode): void {
  mode = MAIL_MODES.includes(next) ? next : 'carry';
}
export function getMailMode(): MailMode {
  return mode;
}
/** Notes left this long (minutes) go by themselves. */
export function setMailNoteTimeoutMin(min: number): void {
  if (Number.isFinite(min) && min > 0) timeoutSec = min * 60;
}

/** A sender's note colour: the same name always gets the same colour. */
export function mailNoteColor(name: string): string {
  let h = 0;
  for (const c of name.trim().toLowerCase()) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return MAIL_NOTE_COLORS[h % MAIL_NOTE_COLORS.length];
}

const same = (a: string | undefined, b: string | undefined) =>
  (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase() && !!(a ?? '').trim();

/** The sender among `characters`: a main agent (not a helper) titled `name`, ignoring case. */
export function findMailSender<C extends Pick<Character, 'id' | 'title' | 'isSubagent'>>(
  characters: Iterable<C>,
  name: string,
  receiverId: number,
): C | null {
  if (!name.trim()) return null;
  for (const ch of characters) {
    if (ch.id === receiverId || ch.isSubagent) continue;
    if (same(ch.title, name)) return ch;
  }
  return null;
}

let nextNoteId = 1;

/**
 * What a message from `sender` (named `from`) to `receiver` hands over: a new
 * work note in the sender's colour, or, when the sender's desk holds work the
 * receiver gave it, that note coming back for review.
 */
export function mailHandover(
  receiver: Pick<Character, 'title'>,
  from: string,
  sender: Pick<Character, 'deskNotes'> | null,
): { note: DeskNote; returning: DeskNote | null } {
  const returning =
    sender?.deskNotes?.find((n) => n.kind === 'work' && same(n.from, receiver.title)) ?? null;
  const note: DeskNote = returning
    ? { ...returning, id: nextNoteId++, kind: 'review', ageSec: 0, minSec: MAIL_NOTE_MIN_SEC, read: false }
    : {
        id: nextNoteId++,
        from,
        color: mailNoteColor(from),
        kind: 'work',
        ageSec: 0,
        minSec: MAIL_NOTE_MIN_SEC,
        read: false,
      };
  return { note, returning };
}

/** Lay `note` on `ch`'s desk (a review note on the tray). A review note that arrives
 *  after its reader's turn already ended counts as read: it goes once seen a while. */
export function layNote(ch: Pick<Character, 'deskNotes' | 'isActive'>, note: DeskNote): void {
  if (note.kind === 'review' && !ch.isActive) note.read = true;
  ch.deskNotes = [...(ch.deskNotes ?? []), note];
}

/** Take note `id` off `ch`'s desk (picked up to be carried back). */
export function takeNote(ch: Pick<Character, 'deskNotes'>, id: number): void {
  if (!ch.deskNotes) return;
  ch.deskNotes = ch.deskNotes.filter((n) => n.id !== id);
}

/** A turn started: `from` names the session that sent it ('' = the user). */
export function receiveMail(receiver: Pick<Character, 'mailFrom'>, from: string): void {
  receiver.mailFrom = from || undefined;
}

/** Envelope from `sender` (null: drops in from above) to the receiver. */
export function flyMail(
  receiver: Pick<Character, 'x' | 'y' | 'mailFlightSec' | 'mailFromX' | 'mailFromY'>,
  sender: Pick<Character, 'x' | 'y'> | null,
): void {
  receiver.mailFlightSec = MAIL_FLIGHT_SEC;
  receiver.mailFromX = sender ? sender.x : receiver.x;
  receiver.mailFromY = sender
    ? sender.y - MAIL_HEAD_RISE_PX
    : receiver.y - MAIL_HEAD_RISE_PX - MAIL_DROP_PX;
}

/** The turn ended: the label goes, and the review notes it read are done with. */
export function endMailTurn(ch: Pick<Character, 'mailFrom' | 'deskNotes'>): void {
  ch.mailFrom = undefined;
  if (!ch.deskNotes) return;
  for (const n of ch.deskNotes) if (n.kind === 'review') n.read = true;
  ch.deskNotes = ch.deskNotes.filter((n) => !(n.read && n.minSec <= 0));
}

export function tickMail(
  ch: Pick<Character, 'deskNotes' | 'mailFlightSec' | 'mailFromX' | 'mailFromY'>,
  dt: number,
): void {
  if (ch.deskNotes?.length) {
    for (const n of ch.deskNotes) {
      n.ageSec += dt;
      n.minSec -= dt;
    }
    const kept = ch.deskNotes.filter(
      (n) => n.ageSec < timeoutSec && !(n.kind === 'review' && n.read && n.minSec <= 0),
    );
    if (kept.length !== ch.deskNotes.length) ch.deskNotes = kept;
  }
  if (ch.mailFlightSec === undefined) return;
  ch.mailFlightSec -= dt;
  if (ch.mailFlightSec <= 0) {
    ch.mailFlightSec = undefined;
    ch.mailFromX = undefined;
    ch.mailFromY = undefined;
  }
}

/** The four tiles beside `at`, each with the way to face to look at `at`. */
export function besideTiles(at: { col: number; row: number }): Array<{
  col: number;
  row: number;
  dir: Direction;
}> {
  return [
    { col: at.col, row: at.row + 1, dir: Dir.UP },
    { col: at.col - 1, row: at.row, dir: Dir.RIGHT },
    { col: at.col + 1, row: at.row, dir: Dir.LEFT },
    { col: at.col, row: at.row - 1, dir: Dir.DOWN },
  ];
}

/** The desk tile a seat faces (the tile one step in its facing direction). */
export function deskTileOf(seat: { seatCol: number; seatRow: number; facingDir: Direction }): {
  col: number;
  row: number;
} {
  const step: Record<Direction, [number, number]> = {
    [Dir.UP]: [0, -1],
    [Dir.DOWN]: [0, 1],
    [Dir.LEFT]: [-1, 0],
    [Dir.RIGHT]: [1, 0],
  };
  const [dc, dr] = step[seat.facingDir];
  return { col: seat.seatCol + dc, row: seat.seatRow + dr };
}

/** Where the envelope is now (world px, its centre), or null with none in flight.
 *  It heads for the receiver's head wherever the receiver has walked to. */
export function mailPoint(
  ch: Pick<Character, 'x' | 'y' | 'mailFlightSec' | 'mailFromX' | 'mailFromY'>,
): { x: number; y: number } | null {
  if (ch.mailFlightSec === undefined || ch.mailFromX === undefined || ch.mailFromY === undefined) {
    return null;
  }
  const t = Math.min(1, Math.max(0, 1 - ch.mailFlightSec / MAIL_FLIGHT_SEC));
  const ease = t * t * (3 - 2 * t);
  const toX = ch.x;
  const toY = ch.y - MAIL_HEAD_RISE_PX;
  return {
    x: ch.mailFromX + (toX - ch.mailFromX) * ease,
    y: ch.mailFromY + (toY - ch.mailFromY) * ease - MAIL_ARC_PX * Math.sin(Math.PI * t),
  };
}

/** The desk note as pixel art: `p` paper, `s` shade (scribbles, the curled corner). 7 x 6. */
export const MAIL_NOTE = [
  'ppppppp',
  'pssssp.',
  'ppppppp',
  'psssspp',
  'pppppps',
  'ppppss.',
] as const;

/** The envelope as pixel art: `#` edge, `o` paper. 9 x 7, centred on mailPoint. */
export const MAIL_ENVELOPE = [
  '#########',
  '##ooooo##',
  '#o#ooo#o#',
  '#oo#o#oo#',
  '#ooo#ooo#',
  '#ooooooo#',
  '#########',
] as const;
