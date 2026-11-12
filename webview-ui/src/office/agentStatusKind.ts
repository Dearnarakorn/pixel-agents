import type { Character, ToolActivity } from './types.js';

/**
 * What an agent is up to, as one word the overview panel can sort and count
 * by. Same reading as the label over the character (ToolOverlay): a
 * permission bubble or a question waiting for an answer needs you; a failed
 * last turn is an error; a turn under way is working; asleep beats done.
 * DOM-free (the office engine runs under Node in the unit tests).
 */
export type AgentStatusKind = 'attention' | 'error' | 'working' | 'done' | 'sleeping' | 'idle';

export function agentStatusKind(
  ch: Character,
  tools: readonly ToolActivity[] | undefined,
  errored: boolean,
  idleSince: number | undefined,
): AgentStatusKind {
  if (ch.bubbleType === 'permission') return 'attention';
  if (tools?.some((t) => !t.done && t.permissionWait)) return 'attention';
  if (ch.bubbleType === 'waiting' && ch.waitingAwaitingInput) return 'attention';
  if (ch.isActive) return 'working';
  if (errored) return 'error';
  if (ch.sleeping) return 'sleeping';
  if (idleSince !== undefined) return 'done';
  return 'idle';
}

/** Sort order in the panel: what needs you first, then what is moving. */
export const STATUS_KIND_ORDER: Record<AgentStatusKind, number> = {
  attention: 0,
  error: 1,
  working: 2,
  done: 3,
  idle: 4,
  sleeping: 5,
};
