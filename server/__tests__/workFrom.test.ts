import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

import { claudeProvider } from '../src/providers/hook/claude/claude.js';
import type { AgentState } from '../src/types.js';
import {
  messagingStatus,
  noteWorkAnswered,
  noteWorkGiven,
  openWork,
  REPORT_WINDOW_MS,
  seedWorkFrom,
  WORK_OPEN_MAX_MS,
} from '../src/workFrom.js';

const BOSS = 'local_14c97969-a5fa-4fe5-91a5-562e44cae3ef';
const prompt = (name: string, from: string) =>
  `Another Claude session sent a message:\n<cross-session-message from="${from}" from-name="${name}">\nplease design the slide\n</cross-session-message>`;
const reply = (to: string) => [
  { type: 'tool_use', name: 'SendMessage', input: { to, message: 'done', summary: 'done' } },
];

describe('work handed between sessions', () => {
  it('opens on a message from another session and closes when the turn that answered it ends', () => {
    const agent = { turnActive: true } as Pick<AgentState, 'workFrom' | 'sentTo' | 'turnActive'>;
    noteWorkGiven(agent, prompt('Boss', BOSS), claudeProvider);
    expect(openWork(agent)).toEqual(['Boss']);
    noteWorkAnswered(agent, reply('local_someone-else'), claudeProvider);
    expect(openWork(agent)).toEqual(['Boss']); // a message to someone else answers nothing
    noteWorkAnswered(agent, reply(BOSS), claudeProvider); // "got it": still working
    expect(openWork(agent)).toEqual(['Boss']);
    agent.turnActive = false;
    expect(openWork(agent, Date.now(), true)).toEqual(['Boss']); // background jobs still run
    expect(openWork(agent)).toEqual([]); // the turn is over: done
  });

  it('review loop: answers never make the giver look like it reports back', () => {
    // Designer: Boss hands work, Designer says "got it" and "done", Boss asks a fix.
    const designer = { turnActive: true } as Pick<AgentState, 'workFrom' | 'sentTo' | 'turnActive'>;
    noteWorkGiven(designer, prompt('Boss', BOSS), claudeProvider);
    noteWorkAnswered(designer, reply(BOSS), claudeProvider); // "got it"
    designer.turnActive = false;
    expect(openWork(designer)).toEqual([]); // that turn ended
    designer.turnActive = true;
    noteWorkAnswered(designer, reply(BOSS), claudeProvider); // "done", a turn later
    expect(designer.sentTo?.has(BOSS) ?? false).toBe(false); // an answer, not a hand-out
    noteWorkGiven(designer, prompt('Boss', BOSS), claudeProvider); // the fix: new work
    expect(openWork(designer)).toEqual(['Boss']);
  });

  it("ignores the user's own prompts and other tools", () => {
    const agent = {} as Pick<AgentState, 'workFrom' | 'turnActive'>;
    noteWorkGiven(agent, 'make the slide prettier', claudeProvider);
    expect(openWork(agent)).toEqual([]);
    noteWorkGiven(agent, prompt('Boss', BOSS), claudeProvider);
    noteWorkAnswered(agent, [{ type: 'tool_use', name: 'Read', input: { to: BOSS } }], claudeProvider);
    expect(openWork(agent)).toEqual(['Boss']);
  });

  it("a report back from someone this agent sent work to isn't new work", () => {
    const boss = {} as Pick<AgentState, 'workFrom' | 'sentTo' | 'turnActive'>;
    const ENG = 'local_eng';
    const t0 = 1_000_000;
    noteWorkAnswered(boss, reply(ENG), claudeProvider, t0); // Boss hands Engineer a job
    noteWorkGiven(boss, prompt('Engineer', ENG), claudeProvider, t0 + 1000); // "got it"
    noteWorkGiven(boss, prompt('Engineer', ENG), claudeProvider, t0 + 600_000); // "done"
    expect(openWork(boss, t0 + 600_000)).toEqual([]);
    // Long after the hand-out, a message from Engineer is a new ask.
    noteWorkGiven(boss, prompt('Engineer', ENG), claudeProvider, t0 + REPORT_WINDOW_MS + 1);
    expect(openWork(boss, t0 + REPORT_WINDOW_MS + 2)).toEqual(['Engineer']);
  });

  it("the desktop app's send_message tool counts like SendMessage", () => {
    const boss = {} as Pick<AgentState, 'workFrom' | 'sentTo' | 'turnActive'>;
    const T22 = 'local_6ebe783f';
    const send = [
      {
        type: 'tool_use',
        name: 'mcp__ccd_session_mgmt__send_message',
        input: { session_id: T22, message: 'do it' },
      },
    ];
    noteWorkAnswered(boss, send, claudeProvider);
    noteWorkGiven(boss, prompt('t22', T22), claudeProvider);
    expect(openWork(boss)).toEqual([]);
  });

  it('labels a message call with the name learnt from that session', () => {
    const agent = {} as Pick<AgentState, 'workFrom' | 'sentTo' | 'turnActive'>;
    noteWorkGiven(agent, prompt('Boss', BOSS), claudeProvider);
    expect(messagingStatus('SendMessage', { to: BOSS }, claudeProvider)).toBe('Messaging Boss');
    expect(
      messagingStatus(
        'mcp__ccd_session_mgmt__send_message',
        { session_id: 'local_never-seen' },
        claudeProvider,
      ),
    ).toBe('Messaging another session');
    expect(messagingStatus('Read', { file_path: 'x' }, claudeProvider)).toBeUndefined();
  });

  it('lets unanswered work go after 30 minutes, but not while the agent works', () => {
    const agent = {} as Pick<AgentState, 'workFrom' | 'turnActive'>;
    noteWorkGiven(agent, prompt('Boss', BOSS), claudeProvider, 0);
    agent.turnActive = true;
    expect(openWork(agent, WORK_OPEN_MAX_MS + 1)).toEqual(['Boss']);
    agent.turnActive = false;
    expect(openWork(agent, WORK_OPEN_MAX_MS - 1)).toEqual(['Boss']);
    expect(openWork(agent, WORK_OPEN_MAX_MS + 1)).toEqual([]);
  });

  it('is read back from the transcript tail when watching starts', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pxl-work-'));
    const file = path.join(dir, 's.jsonl');
    const lines = [
      { type: 'user', isMeta: true, message: { role: 'user', content: prompt('Boss', BOSS) } },
      { type: 'user', isMeta: true, message: { role: 'user', content: prompt('Analyst', 'local_a') } },
      { type: 'assistant', message: { content: reply('local_a') } },
    ];
    fs.writeFileSync(file, lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
    const agent = { jsonlFile: file } as AgentState;
    seedWorkFrom(agent, claudeProvider);
    expect(openWork(agent)).toEqual(['Boss']);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
