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
const WORK_SEED_TAIL_BYTES = 4 * 1024 * 1024; // a busy lead writes MBs between hand-outs
/** Work nobody answers is let go once it is this old and its agent isn't working:
 *  a job done without a reply would otherwise say "from Boss" for ever. */
export const WORK_OPEN_MAX_MS = 30 * 60 * 1000;
/** Messages from a session this agent handed work to within this long are its
 *  reports ("got it", then "done"), not new work. */
export const REPORT_WINDOW_MS = 60 * 60 * 1000;

type WorkState = Pick<AgentState, 'workFrom' | 'sentTo'>;

/**
 * Leads (zones.json `leadZones`, set by officeExtras): a lead's messages are
 * always work for the receiver, and messages to a lead are always reports. Between
 * two sessions that message each other back and forth, the content can't say who
 * gives the work; the team's lead can.
 */
let leadAgent: (agent: WorkState) => boolean = () => false;
let leadName: (name: string) => boolean = () => false;

export function setWorkLeads(
  isLeadAgent: (agent: WorkState) => boolean,
  isLeadName: (name: string) => boolean,
): void {
  leadAgent = isLeadAgent;
  leadName = isLeadName;
}

/** Session names by address, learnt from every message seen (address → from-name). */
const sessionNames = new Map<string, string>();

/** The name of the session at `address`, when any message from it has been seen. */
export function sessionNameOf(address: string): string | undefined {
  return sessionNames.get(address);
}

/** A label for a tool call that messages another session ("Messaging Boss"), or
 *  undefined when the call is no such message. */
export function messagingStatus(
  toolName: string,
  input: Record<string, unknown>,
  provider: HookProvider | null | undefined,
): string | undefined {
  const to = provider?.messageRecipient?.(toolName, input);
  if (!to) return undefined;
  return `Messaging ${sessionNameOf(to) ?? 'another session'}`;
}

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
  sessionNames.set(address, from);
  // To a lead: a report. From a lead: work.
  if (leadAgent(agent)) return;
  if (!leadName(from)) {
    // From a session this agent sent work to lately: its report back ("got it",
    // then "done": every one of them), not new work.
    const handedAt = agent.sentTo?.get(address);
    if (handedAt !== undefined && at - handedAt <= REPORT_WINDOW_MS) return;
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
  at = Date.now(),
): void {
  if (!provider?.messageRecipient) return;
  for (const b of blocks) {
    if (b.type !== 'tool_use') continue;
    const to = provider.messageRecipient(b.name || '', b.input || {});
    if (!to) continue;
    // An answer ("got it", "done") marks the work answered; it closes when this
    // turn ends (openWork), so "got it" early in the turn doesn't end it. Work
    // closed lately still counts: a "done" in a later turn answers it too, and
    // must not make the giver look like someone this agent handed work to.
    let answered = false;
    for (const [, open] of agent.workFrom ?? []) {
      if (open.address === to && (!open.closedAt || at - open.closedAt <= REPORT_WINDOW_MS)) {
        open.answered = true;
        answered = true;
      }
    }
    if (!answered) (agent.sentTo ??= new Map()).set(to, at);
  }
}

/** The givers of the work still open, for the office (old unanswered work let go
 *  while the agent isn't working: WORK_OPEN_MAX_MS). */
export function openWork(
  agent: Pick<AgentState, 'workFrom' | 'turnActive'>,
  now = Date.now(),
  /** The turn ended but background jobs it started still run: not done yet. */
  stillBusy = false,
): string[] {
  if (!agent.workFrom) return [];
  for (const [giver, open] of agent.workFrom) {
    if (open.closedAt) {
      // Kept a while after closing (a late "done" still answers it), then dropped.
      if (now - open.closedAt > REPORT_WINDOW_MS) agent.workFrom.delete(giver);
      continue;
    }
    // Answered and the turn is over: done. Or nobody answered for too long.
    if (!agent.turnActive && ((open.answered && !stillBusy) || now - open.at > WORK_OPEN_MAX_MS)) {
      open.closedAt = now;
    }
  }
  return [...agent.workFrom].filter(([, open]) => !open.closedAt).map(([giver]) => giver);
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
      const at = record.timestamp ? Date.parse(record.timestamp) : NaN;
      noteWorkAnswered(
        agent,
        content as Array<{ type: string; name?: string; input?: Record<string, unknown> }>,
        provider,
        Number.isFinite(at) ? at : Date.now(),
      );
    }
  }
}
