/**
 * Mail between sessions: when one session's message starts another's turn (the
 * server's agentStatus `messageFrom`), an envelope flies from the sender's
 * character to the receiver's, the receiver walks over to the sender to take
 * the work and back to its desk, a note in the sender's colour sits on the
 * receiver's desk while the turn runs, and its label says who sent it. DOM-free.
 */

import {
  MAIL_ARC_PX,
  MAIL_DROP_PX,
  MAIL_FLIGHT_SEC,
  MAIL_HEAD_RISE_PX,
  MAIL_NOTE_COLORS,
  MAIL_NOTE_MIN_SEC,
  MAIL_VISIT_WAIT_SEC,
} from '../../constants.js';
import type { Character, Direction } from '../types.js';
import { Direction as Dir } from '../types.js';

type MailFields = Pick<
  Character,
  | 'x'
  | 'y'
  | 'mailFrom'
  | 'mailFlightSec'
  | 'mailFromX'
  | 'mailFromY'
  | 'mailVisit'
  | 'mailNote'
  | 'mailNoteMinSec'
>;

/** A sender's note colour: the same name always gets the same colour. */
export function mailNoteColor(name: string): string {
  let h = 0;
  for (const c of name.trim().toLowerCase()) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return MAIL_NOTE_COLORS[h % MAIL_NOTE_COLORS.length];
}

/** What the office worked out for this mail: where to stand by the sender, where the desk is. */
export interface MailPlan {
  visit?: { col: number; row: number; dir: Direction };
  note?: { x: number; y: number; zY: number };
}

/** The sender among `characters`: a main agent (not a helper) titled `name`, ignoring case. */
export function findMailSender<C extends Pick<Character, 'id' | 'title' | 'isSubagent'>>(
  characters: Iterable<C>,
  name: string,
  receiverId: number,
): C | null {
  const want = name.trim().toLowerCase();
  if (!want) return null;
  for (const ch of characters) {
    if (ch.id === receiverId || ch.isSubagent) continue;
    if ((ch.title ?? '').trim().toLowerCase() === want) return ch;
  }
  return null;
}

/**
 * A turn started: `from` is the sending session's name ('' = the user). Mail
 * from a session flies from `sender` (null: drops in from above the receiver).
 */
export function receiveMail(
  receiver: MailFields,
  from: string,
  sender: Pick<Character, 'x' | 'y'> | null,
  plan: MailPlan = {},
): void {
  if (!from) {
    receiver.mailFrom = undefined;
    return;
  }
  receiver.mailFrom = from;
  receiver.mailFlightSec = MAIL_FLIGHT_SEC;
  receiver.mailFromX = sender ? sender.x : receiver.x;
  receiver.mailFromY = sender
    ? sender.y - MAIL_HEAD_RISE_PX
    : receiver.y - MAIL_HEAD_RISE_PX - MAIL_DROP_PX;
  // Walk over to take the work (only from a sender who is here to visit).
  receiver.mailVisit = sender && plan.visit
    ? { ...plan.visit, waitSec: MAIL_VISIT_WAIT_SEC, arrived: false }
    : undefined;
  if (plan.note) {
    receiver.mailNote = { ...plan.note, color: mailNoteColor(from) };
    receiver.mailNoteMinSec = MAIL_NOTE_MIN_SEC;
  }
}

/** The turn ended: the label goes, the note once it has had its minimum time
 *  (mail still in the air finishes its flight, a visit under way finishes too:
 *  a quick reply must not cut the walk short). */
export function endMailTurn(receiver: MailFields): void {
  receiver.mailFrom = undefined;
  if ((receiver.mailNoteMinSec ?? 0) <= 0) receiver.mailNote = undefined;
}

export function tickMail(ch: MailFields, dt: number): void {
  if (ch.mailNoteMinSec !== undefined) {
    ch.mailNoteMinSec -= dt;
    if (ch.mailNoteMinSec <= 0) {
      ch.mailNoteMinSec = undefined;
      if (!ch.mailFrom) ch.mailNote = undefined;
    }
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
export function mailPoint(ch: MailFields): { x: number; y: number } | null {
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
