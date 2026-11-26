import assert from 'node:assert/strict';

import { afterEach, test } from 'vitest';

import {
  MAIL_DROP_PX,
  MAIL_FLIGHT_SEC,
  MAIL_HEAD_RISE_PX,
  MAIL_NOTE_COLORS,
  MAIL_NOTE_MIN_SEC,
  MAIL_NOTE_TIMEOUT_DEFAULT_MIN,
} from '../src/constants.js';
import {
  besideTiles,
  deskTileOf,
  endMailTurn,
  findMailSender,
  flyMail,
  getMailMode,
  layNote,
  MAIL_ENVELOPE,
  MAIL_NOTE,
  mailHandover,
  mailNoteColor,
  mailPoint,
  receiveMail,
  setMailMode,
  setMailNoteTimeoutMin,
  takeNote,
  tickMail,
} from '../src/office/engine/mail.js';
import type { Character, DeskNote } from '../src/office/types.js';

type Agent = Pick<
  Character,
  'x' | 'y' | 'title' | 'isActive' | 'mailFrom' | 'mailFlightSec' | 'mailFromX' | 'mailFromY' | 'deskNotes'
>;
const agent = (title: string, isActive = true): Agent => ({ x: 0, y: 0, title, isActive });

afterEach(() => {
  setMailMode('carry');
  setMailNoteTimeoutMin(MAIL_NOTE_TIMEOUT_DEFAULT_MIN);
});

test('the sender is the main agent titled with the name, ignoring case and spaces', () => {
  const cast = [
    { id: 1, title: 'Engineer', isSubagent: false },
    { id: 2, title: 'Boss', isSubagent: true },
    { id: 3, title: ' boss ', isSubagent: false },
  ];
  assert.equal(findMailSender(cast, 'Boss', 1)?.id, 3);
  assert.equal(findMailSender(cast, 'Engineer', 1), null); // never the receiver itself
  assert.equal(findMailSender(cast, 'Designer', 1), null);
  assert.equal(findMailSender(cast, '', 1), null);
});

test('assign, return, review: the note goes there and back in the giver colour', () => {
  const boss = agent('Boss');
  const sec = agent('Secretary');
  // Boss -> Secretary: a new work note in Boss's colour for Secretary's desk.
  const give = mailHandover(sec, 'Boss', boss);
  assert.equal(give.returning, null);
  assert.equal(give.note.kind, 'work');
  assert.equal(give.note.color, mailNoteColor('Boss'));
  layNote(sec, give.note);
  // Secretary -> Boss: Boss's note comes back off Secretary's desk, for review.
  const back = mailHandover(boss, 'Secretary', sec);
  assert.equal(back.returning?.id, give.note.id);
  assert.equal(back.note.kind, 'review');
  assert.equal(back.note.color, mailNoteColor('Boss'));
  takeNote(sec, back.returning!.id);
  layNote(boss, back.note);
  assert.deepEqual(sec.deskNotes, []);
  assert.equal(boss.deskNotes?.length, 1);
});

test('the note a quick reply returns must be on the replier desk first', () => {
  // officeState lays a still-carried note on the replier's desk before the
  // handover; with it there, the reply is a return, not new work.
  const boss = agent('Boss');
  const t22 = agent('t22');
  const carried = mailHandover(t22, 'Boss', boss).note;
  assert.equal(mailHandover(boss, 't22', t22).returning, null); // still in Boss's paws
  layNote(t22, carried);
  assert.equal(mailHandover(boss, 't22', t22).returning?.id, carried.id);
});

test('a message with no work out is new work, even between the same pair', () => {
  const a = agent('Analyst');
  const d = agent('Designer');
  const first = mailHandover(d, 'Analyst', a); // Analyst gives Designer work
  layNote(d, first.note);
  const more = mailHandover(d, 'Analyst', a); // and more: Analyst's desk holds none of Designer's
  assert.equal(more.returning, null);
  assert.equal(more.note.kind, 'work');
});

test("a review note goes when its reader's turn ends, after showing a while", () => {
  const boss = agent('Boss', true);
  layNote(boss, mailHandover(boss, 'Secretary', null).note); // work from someone not here
  const review: DeskNote = { ...mailHandover(boss, 'X', null).note, kind: 'review' };
  layNote(boss, review);
  endMailTurn(boss); // read, but not shown long enough yet
  assert.equal(boss.deskNotes?.length, 2);
  tickMail(boss, MAIL_NOTE_MIN_SEC + 0.1);
  assert.deepEqual(
    boss.deskNotes?.map((n) => n.kind),
    ['work'],
  );
});

test('a review note arriving after the turn ended counts as read', () => {
  const idle = agent('Boss', false);
  const review: DeskNote = { ...mailHandover(idle, 'X', null).note, kind: 'review' };
  layNote(idle, review);
  assert.equal(review.read, true);
  tickMail(idle, MAIL_NOTE_MIN_SEC + 0.1);
  assert.deepEqual(idle.deskNotes, []);
});

test('work nobody answers goes after the timeout (a setting)', () => {
  setMailNoteTimeoutMin(15);
  const d = agent('Designer');
  layNote(d, mailHandover(d, 'Boss', null).note);
  tickMail(d, 14 * 60);
  assert.equal(d.deskNotes?.length, 1);
  tickMail(d, 61);
  assert.deepEqual(d.deskNotes, []);
});

test('the label follows the turn; the user prompting clears it', () => {
  const d = agent('Designer');
  receiveMail(d, 'Boss');
  assert.equal(d.mailFrom, 'Boss');
  receiveMail(d, '');
  assert.equal(d.mailFrom, undefined);
  receiveMail(d, 'Boss');
  endMailTurn(d);
  assert.equal(d.mailFrom, undefined);
});

test('mail flies from the sender, or drops in from above', () => {
  const rx = { ...agent('Rx'), x: 100, y: 100 };
  flyMail(rx, { x: 20, y: 60 });
  assert.deepEqual(mailPoint(rx), { x: 20, y: 60 - MAIL_HEAD_RISE_PX });
  tickMail(rx, MAIL_FLIGHT_SEC + 0.01);
  assert.equal(mailPoint(rx), null);
  flyMail(rx, null);
  assert.deepEqual(mailPoint(rx), { x: 100, y: 100 - MAIL_HEAD_RISE_PX - MAIL_DROP_PX });
});

test('modes: carry by default, unknown ones fall back to carry', () => {
  assert.equal(getMailMode(), 'carry');
  setMailMode('visit');
  assert.equal(getMailMode(), 'visit');
  setMailMode('nonsense' as never);
  assert.equal(getMailMode(), 'carry');
});

test('colours: one per name, from the palette', () => {
  assert.equal(mailNoteColor('Boss'), mailNoteColor(' boss '));
  assert.ok((MAIL_NOTE_COLORS as readonly string[]).includes(mailNoteColor('Designer')));
});

test('beside tiles face the middle; the desk is one step the way a seat faces', () => {
  for (const t of besideTiles({ col: 5, row: 5 })) {
    const back = deskTileOf({ seatCol: t.col, seatRow: t.row, facingDir: t.dir });
    assert.deepEqual(back, { col: 5, row: 5 });
  }
});

test('the note and envelope art are tidy grids', () => {
  for (const row of MAIL_NOTE) assert.match(row, /^[ps.]{7}$/);
  assert.equal(MAIL_NOTE.length, 6);
  for (const row of MAIL_ENVELOPE) assert.match(row, /^[#o]{9}$/);
});
