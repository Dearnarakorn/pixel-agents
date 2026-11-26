import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

import { claudeProvider } from '../src/providers/hook/claude/claude.js';
import type { AgentState } from '../src/types.js';
import { noteWorkAnswered, noteWorkGiven, openWork, seedWorkFrom } from '../src/workFrom.js';

const BOSS = 'local_14c97969-a5fa-4fe5-91a5-562e44cae3ef';
const prompt = (name: string, from: string) =>
  `Another Claude session sent a message:\n<cross-session-message from="${from}" from-name="${name}">\nplease design the slide\n</cross-session-message>`;
const reply = (to: string) => [
  { type: 'tool_use', name: 'SendMessage', input: { to, message: 'done', summary: 'done' } },
];

describe('work handed between sessions', () => {
  it('opens on a message from another session and closes on the reply to it', () => {
    const agent = {} as Pick<AgentState, 'workFrom'>;
    noteWorkGiven(agent, prompt('Boss', BOSS), claudeProvider);
    expect(openWork(agent)).toEqual(['Boss']);
    noteWorkAnswered(agent, reply('local_someone-else'), claudeProvider);
    expect(openWork(agent)).toEqual(['Boss']); // a message to someone else answers nothing
    noteWorkAnswered(agent, reply(BOSS), claudeProvider);
    expect(openWork(agent)).toEqual([]);
  });

  it("ignores the user's own prompts and other tools", () => {
    const agent = {} as Pick<AgentState, 'workFrom'>;
    noteWorkGiven(agent, 'make the slide prettier', claudeProvider);
    expect(openWork(agent)).toEqual([]);
    noteWorkGiven(agent, prompt('Boss', BOSS), claudeProvider);
    noteWorkAnswered(agent, [{ type: 'tool_use', name: 'Read', input: { to: BOSS } }], claudeProvider);
    expect(openWork(agent)).toEqual(['Boss']);
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
