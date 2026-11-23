import assert from 'node:assert/strict';

import { test } from 'vitest';

import { MAIL_DROP_PX, MAIL_FLIGHT_SEC, MAIL_HEAD_RISE_PX } from '../src/constants.js';
import {
  endMailTurn,
  findMailSender,
  MAIL_ENVELOPE,
  mailPoint,
  receiveMail,
  tickMail,
} from '../src/office/engine/mail.js';

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

test('the envelope art is a rectangle of edge and paper', () => {
  for (const row of MAIL_ENVELOPE) {
    assert.equal(row.length, MAIL_ENVELOPE[0].length);
    assert.match(row, /^[#o]+$/);
  }
});
