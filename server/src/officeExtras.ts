/**
 * Office extras for external agents (sessions adopted from their transcripts):
 *
 * - title: the conversation's title, drawn on the agent's label.
 * - zone: the project group an agent belongs to, decided from its transcript
 *   folder by user rules; the office seats it in the layout Area of that name.
 * - sleep: an agent idle past a threshold is reported asleep.
 * - pruning: long-idle agents, and older duplicates of a continued
 *   conversation, are removed.
 *
 * Everything here reads only the agent's own state and transcript file; none
 * of it needs hooks, so it works the same with hooks on or off.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import type { AgentStateStore } from './agentStateStore.js';
import {
  AGENT_REMOVE_AFTER_HOURS,
  AGENT_SLEEP_AFTER_MIN,
  AGENT_TITLE_MAX_LENGTH,
  DUPLICATE_TITLE_IDLE_MS,
  PIXEL_AGENTS_DIR,
  ZONES_CACHE_MS,
  ZONES_FILE_NAME,
} from './constants.js';
import { getHookProvider } from './transcriptParser.js';
import type { AgentState } from './types.js';

// ── Titles ───────────────────────────────────────────────────

/** The agent's conversation title as its CLI shows it, cut to label length;
 *  undefined when the provider names no conversations or this one has none. */
export function agentTitle(agent: AgentState): string | undefined {
  if (!agent.jsonlFile) return undefined;
  let title: string | undefined;
  try {
    title = getHookProvider()?.conversationTitle?.(agent.jsonlFile);
  } catch {
    return undefined;
  }
  const trimmed = title?.trim();
  if (!trimmed) return undefined;
  return trimmed.length > AGENT_TITLE_MAX_LENGTH
    ? `${trimmed.slice(0, AGENT_TITLE_MAX_LENGTH - 1)}…`
    : trimmed;
}

/** Titles of every agent that has one, keyed by agent id (for `existingAgents`). */
export function agentTitles(store: AgentStateStore): Record<number, string> {
  const titles: Record<number, string> = {};
  for (const [id, agent] of store) {
    const title = agentTitle(agent);
    if (title) titles[id] = title;
  }
  return titles;
}

/**
 * Every `agentStatus` broadcast carries the agent's current title, so a label
 * follows a rename or a first title without a message of its own. Wraps
 * `store.broadcast`; call once at startup.
 */
export function attachTitlesToStatus(store: AgentStateStore): void {
  const broadcast = store.broadcast.bind(store);
  store.broadcast = (message: Record<string, unknown>): void => {
    if (message.type === 'agentStatus' && typeof message.id === 'number') {
      const agent = store.get(message.id);
      const title = agent ? agentTitle(agent) : undefined;
      if (title) message.title = title;
    }
    broadcast(message);
  };
}

// ── Project groups (zones) ───────────────────────────────────

type ZoneRule = [pattern: RegExp, zone: string];

let zoneRules: ZoneRule[] = [];
let zoneRulesReadAt = 0;

/**
 * The rules in ~/.pixel-agents/zones.json: `{ "rules": [[regex, zone], ...] }`.
 * Each regex is tested, case-insensitively, against the name of the agent's
 * transcript folder (the session's working directory as the CLI encodes it);
 * the first match names the zone, which must be an Area label in the layout.
 * No file, a broken file or no match = no zone. Re-read at most every
 * ZONES_CACHE_MS, so edits apply without a restart.
 */
function readZoneRules(): ZoneRule[] {
  const now = Date.now();
  if (zoneRulesReadAt !== 0 && now - zoneRulesReadAt < ZONES_CACHE_MS) return zoneRules;
  zoneRulesReadAt = now;
  const rules: ZoneRule[] = [];
  try {
    const file = path.join(os.homedir(), PIXEL_AGENTS_DIR, ZONES_FILE_NAME);
    const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
    const list =
      parsed && typeof parsed === 'object' ? (parsed as { rules?: unknown }).rules : undefined;
    if (Array.isArray(list)) {
      for (const rule of list) {
        if (!Array.isArray(rule) || typeof rule[0] !== 'string' || typeof rule[1] !== 'string') {
          continue;
        }
        try {
          rules.push([new RegExp(rule[0], 'i'), rule[1]]);
        } catch {
          // an invalid regex skips its rule, not the file
        }
      }
    }
  } catch {
    // no file, or not JSON: no rules
  }
  zoneRules = rules;
  return rules;
}

/** The project group of an agent, or undefined when no rule matches. */
export function agentZone(agent: AgentState): string | undefined {
  if (!agent.projectDir) return undefined;
  const folder = path.basename(agent.projectDir);
  for (const [pattern, zone] of readZoneRules()) {
    if (pattern.test(folder)) return zone;
  }
  return undefined;
}

/** Zones of every agent that has one, keyed by agent id (for `existingAgents`). */
export function agentZones(store: AgentStateStore): Record<number, string> {
  const zones: Record<number, string> = {};
  for (const [id, agent] of store) {
    const zone = agentZone(agent);
    if (zone) zones[id] = zone;
  }
  return zones;
}

// ── Sleep + pruning ──────────────────────────────────────────

function envNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * One pass over the external agents, run by the stale check:
 * broadcasts `agentStatus { sleeping: true }` for each one idle past the sleep
 * threshold (repeated every pass, so an office that connects later hears it
 * too), and returns the ids to remove — idle past the removal threshold, or an
 * older duplicate of a conversation another agent is carrying on.
 * `skip` holds ids the caller already decided to remove.
 */
export function sleepAndPrune(store: AgentStateStore, skip: ReadonlySet<number>): number[] {
  const now = Date.now();
  const sleepAfterMs = envNumber('PIXEL_AGENTS_SLEEP_MIN', AGENT_SLEEP_AFTER_MIN) * 60_000;
  const removeAfterMs = envNumber('PIXEL_AGENTS_REMOVE_HOURS', AGENT_REMOVE_AFTER_HOURS) * 3_600_000;

  const rows: Array<{ id: number; agent: AgentState; mtime: number; title: string | undefined }> =
    [];
  const newestByTitle = new Map<string, number>();
  for (const [id, agent] of store) {
    // Teammates share their lead's lifecycle; leave them to it.
    if (!agent.isExternal || agent.leadAgentId !== undefined || skip.has(id)) continue;
    let mtime: number;
    try {
      mtime = fs.statSync(agent.jsonlFile).mtimeMs;
    } catch {
      continue;
    }
    const title = agentTitle(agent);
    rows.push({ id, agent, mtime, title });
    if (title && (newestByTitle.get(title) ?? 0) < mtime) newestByTitle.set(title, mtime);
  }

  const remove: number[] = [];
  for (const { id, agent, mtime, title } of rows) {
    if (agent.turnActive) continue;
    const idleMs = now - mtime;
    const superseded =
      title !== undefined &&
      (newestByTitle.get(title) ?? 0) > mtime &&
      idleMs > DUPLICATE_TITLE_IDLE_MS;
    if (idleMs > removeAfterMs || superseded) {
      remove.push(id);
    } else if (idleMs > sleepAfterMs) {
      store.broadcast({ type: 'agentStatus', id, status: 'waiting', sleeping: true });
    }
  }
  return remove;
}
