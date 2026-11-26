/**
 * Work handed between sessions, as each agent's transcript tells it: a message
 * from another session opens work from that session (its name and the address a
 * reply goes to); this agent's own message back to that address closes it. A
 * message from a session this agent itself sent work to is that session's report
 * back, not new work. The office shows the open work (agentStatus.workFrom:
 * "from Boss", the note on the desk) for as long as it is open, across turns,
 * page loads and restarts.
 */

import * as fs from 'fs';

import type { HookProvider } from '../../core/src/provider.js';
import type { AgentState } from './types.js';

/** How much of a transcript's end is read for the work still open when watching starts. */
const WORK_SEED_TAIL_BYTES = 512 * 1024;
/** Work nobody answers is let go once it is this old and its agent isn't working:
 *  a job done without a reply would otherwise say "from Boss" for ever. */
export const WORK_OPEN_MAX_MS = 30 * 60 * 1000;

type WorkState = Pick<AgentState, 'workFrom' | 'sentTo'>;

/** A prompt opened work when another session sent it (unless it reports back). */
export function noteWorkGiven(
  agent: WorkState,
  promptText: string,
  provider: HookProvider | null | undefined,
  at = Date.now(),
): void {
  const from = provider?.messageSender?.(promptText);
  const address = from ? provider?.messageSenderAddress?.(promptText) : undefined;
  if (!from || !address) return;
  // From a session this agent sent work to: its report back, not new work.
  if (agent.sentTo?.has(address)) {
    agent.sentTo.delete(address);
    return;
  }
  agent.workFrom ??= new Map();
  agent.workFrom.set(from, { address, at });
}

/** A message to a session this agent owes an answer closes that work; any other
 *  message hands work out (the next message from there is its report). */
export function noteWorkAnswered(
  agent: WorkState,
  blocks: ReadonlyArray<{ type: string; name?: string; input?: Record<string, unknown> }>,
  provider: HookProvider | null | undefined,
): void {
  if (!provider?.messageRecipient) return;
  for (const b of blocks) {
    if (b.type !== 'tool_use') continue;
    const to = provider.messageRecipient(b.name || '', b.input || {});
    if (!to) continue;
    let answered = false;
    for (const [giver, open] of agent.workFrom ?? []) {
      if (open.address === to) {
        agent.workFrom?.delete(giver);
        answered = true;
      }
    }
    if (!answered) (agent.sentTo ??= new Set()).add(to);
  }
}

/** The givers of the work still open, for the office (old unanswered work let go
 *  while the agent isn't working: WORK_OPEN_MAX_MS). */
export function openWork(
  agent: Pick<AgentState, 'workFrom' | 'turnActive'>,
  now = Date.now(),
): string[] {
  if (!agent.workFrom) return [];
  if (!agent.turnActive) {
    for (const [giver, open] of agent.workFrom) {
      if (now - open.at > WORK_OPEN_MAX_MS) agent.workFrom.delete(giver);
    }
  }
  return [...agent.workFrom.keys()];
}

/**
 * Work still open when watching starts (an agent restored or adopted mid-session
 * starts reading at the end of its transcript): replay the tail's messages.
 */
export function seedWorkFrom(agent: AgentState, provider: HookProvider | null | undefined): void {
  if (!agent.jsonlFile || !provider?.messageSender) return;
  let text: string;
  try {
    const stat = fs.statSync(agent.jsonlFile);
    const start = Math.max(0, stat.size - WORK_SEED_TAIL_BYTES);
    const length = stat.size - start;
    if (length <= 0) return;
    const fd = fs.openSync(agent.jsonlFile, 'r');
    try {
      const buf = Buffer.alloc(length);
      fs.readSync(fd, buf, 0, length, start);
      text = buf.toString('utf8');
    } finally {
      fs.closeSync(fd);
    }
    if (start > 0) text = text.slice(text.indexOf('\n') + 1);
  } catch {
    return; // unreadable: the stream fills it in from the next message
  }
  for (const line of text.split('\n')) {
    // Cheap filter: only lines that can matter are parsed.
    if (!line.includes('cross-session-message') && !line.includes('"tool_use"')) continue;
    let record: {
      type?: string;
      timestamp?: string;
      isSidechain?: boolean;
      message?: { content?: unknown };
      content?: unknown;
    };
    try {
      record = JSON.parse(line);
    } catch {
      continue;
    }
    if (record.isSidechain === true) continue;
    const content = record.message?.content ?? record.content;
    if (record.type === 'user') {
      const promptText =
        typeof content === 'string'
          ? content
          : Array.isArray(content)
            ? (content as Array<{ type?: string; text?: unknown }>)
                .map((b) => (b.type === 'text' && typeof b.text === 'string' ? b.text : ''))
                .join('\n')
            : '';
      const at = record.timestamp ? Date.parse(record.timestamp) : NaN;
      if (promptText) {
        noteWorkGiven(agent, promptText, provider, Number.isFinite(at) ? at : Date.now());
      }
    } else if (record.type === 'assistant' && Array.isArray(content)) {
      noteWorkAnswered(
        agent,
        content as Array<{ type: string; name?: string; input?: Record<string, unknown> }>,
        provider,
      );
    }
  }
}
