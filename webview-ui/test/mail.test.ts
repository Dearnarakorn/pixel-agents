import assert from 'node:assert/strict';

import { test } from 'vitest';

import {
  MAIL_DROP_PX,
  MAIL_FLIGHT_SEC,
  MAIL_HEAD_RISE_PX,
  MAIL_NOTE_COLORS,
  MAIL_NOTE_MIN_SEC,
  MAIL_VISIT_WAIT_SEC,
} from '../src/constants.js';
import {
  besideTiles,
  deskTileOf,
  endMailTurn,
  findMailSender,
  MAIL_ENVELOPE,
  MAIL_NOTE,
  mailNoteColor,
  mailPoint,
  receiveMail,
  tickMail,
} from '../src/office/engine/mail.js';
import { Direction } from '../src/office/types.js';

type Mailbox = Parameters<typeof receiveMail>[0];
const at = (x: number, y: number): Mailbox => ({ x, y });

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

test('mail flies from the sender to the receiver, then lands', () => {
  const rx = at(100, 100);
  receiveMail(rx, 'Boss', { x: 20, y: 60 });
  assert.equal(rx.mailFrom, 'Boss');
  const start = mailPoint(rx)!;
  assert.deepEqual(start, { x: 20, y: 60 - MAIL_HEAD_RISE_PX });
  tickMail(rx, MAIL_FLIGHT_SEC / 2);
  const mid = mailPoint(rx)!;
  assert.ok(mid.x > 20 && mid.x < 100);
  tickMail(rx, MAIL_FLIGHT_SEC / 2 + 0.01);
  assert.equal(mailPoint(rx), null);
  assert.equal(rx.mailFrom, 'Boss'); // the label stays until the turn ends
  endMailTurn(rx);
  assert.equal(rx.mailFrom, undefined);
});

test('mail from a session not in the office drops in from above', () => {
  const rx = at(50, 80);
  receiveMail(rx, 'Ghost', null);
  assert.deepEqual(mailPoint(rx), { x: 50, y: 80 - MAIL_HEAD_RISE_PX - MAIL_DROP_PX });
});

test("the user's own prompt clears the label and sends no mail", () => {
  const rx = at(0, 0);
  rx.mailFrom = 'Boss';
  receiveMail(rx, '', null);
  assert.equal(rx.mailFrom, undefined);
  assert.equal(mailPoint(rx), null);
});

test('mail from someone here plans a visit and a desk note in the sender colour', () => {
  const rx = at(100, 100);
  receiveMail(rx, 'Boss', { x: 20, y: 60 }, {
    visit: { col: 1, row: 4, dir: Direction.UP },
    note: { x: 50, y: 40, zY: 48.6 },
  });
  assert.deepEqual(rx.mailVisit, {
    col: 1,
    row: 4,
    dir: Direction.UP,
    waitSec: MAIL_VISIT_WAIT_SEC,
    arrived: false,
  });
  assert.equal(rx.mailNote?.color, mailNoteColor('Boss'));
  assert.equal(mailNoteColor('Boss'), mailNoteColor(' boss '));
  assert.ok((MAIL_NOTE_COLORS as readonly string[]).includes(mailNoteColor('Designer')));
});

test('no visit when the sender is not in the office (the note still goes on the desk)', () => {
  const rx = at(0, 0);
  receiveMail(rx, 'Ghost', null, {
    visit: { col: 1, row: 1, dir: Direction.UP },
    note: { x: 1, y: 1, zY: 1 },
  });
  assert.equal(rx.mailVisit, undefined);
  assert.ok(rx.mailNote);
});

test('the note stays through the turn and at least MAIL_NOTE_MIN_SEC', () => {
  const quick = at(0, 0);
  receiveMail(quick, 'Boss', null, { note: { x: 1, y: 1, zY: 1 } });
  endMailTurn(quick); // a quick reply
  assert.ok(quick.mailNote, 'kept for its minimum time');
  tickMail(quick, MAIL_NOTE_MIN_SEC + 0.1);
  assert.equal(quick.mailNote, undefined);

  const long = at(0, 0);
  receiveMail(long, 'Boss', null, { note: { x: 1, y: 1, zY: 1 } });
  tickMail(long, MAIL_NOTE_MIN_SEC + 5);
  assert.ok(long.mailNote, 'kept while the turn runs');
  endMailTurn(long);
  assert.equal(long.mailNote, undefined);
});

test('a visit is not called off by the turn ending', () => {
  const rx = at(0, 0);
  receiveMail(rx, 'Boss', { x: 5, y: 5 }, { visit: { col: 1, row: 1, dir: Direction.LEFT } });
  endMailTurn(rx);
  assert.ok(rx.mailVisit);
});

test('beside tiles face the middle; the desk is one step the way a seat faces', () => {
  for (const t of besideTiles({ col: 5, row: 5 })) {
    const back = deskTileOf({ seatCol: t.col, seatRow: t.row, facingDir: t.dir });
    assert.deepEqual(back, { col: 5, row: 5 });
  }
});

test('the desk note art is a 7 x 6 block of paper and shade', () => {
  for (const row of MAIL_NOTE) {
    assert.equal(row.length, 7);
    assert.match(row, /^[ps.]+$/);
  }
  assert.equal(MAIL_NOTE.length, 6);
});

test('the envelope art is a rectangle of edge and paper', () => {
  for (const row of MAIL_ENVELOPE) {
    assert.equal(row.length, MAIL_ENVELOPE[0].length);
    assert.match(row, /^[#o]+$/);
  }
});
