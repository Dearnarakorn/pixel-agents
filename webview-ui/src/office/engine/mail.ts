/**
 * Mail between sessions: when one session's message starts another's turn (the
 * server's agentStatus `messageFrom`), an envelope flies from the sender's
 * character to the receiver's, and the receiver's label says who sent it until
 * its turn ends. DOM-free.
 */

import { MAIL_ARC_PX, MAIL_DROP_PX, MAIL_FLIGHT_SEC, MAIL_HEAD_RISE_PX } from '../../constants.js';
import type { Character } from '../types.js';

type MailFields = Pick<
  Character,
  'x' | 'y' | 'mailFrom' | 'mailFlightSec' | 'mailFromX' | 'mailFromY'
>;

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
}

/** The turn ended: the label goes (mail still in the air finishes its flight). */
export function endMailTurn(receiver: MailFields): void {
  receiver.mailFrom = undefined;
}

export function tickMail(ch: MailFields, dt: number): void {
  if (ch.mailFlightSec === undefined) return;
  ch.mailFlightSec -= dt;
  if (ch.mailFlightSec <= 0) {
    ch.mailFlightSec = undefined;
    ch.mailFromX = undefined;
    ch.mailFromY = undefined;
  }
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
