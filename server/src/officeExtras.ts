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
      // The zone too: a title rule can move an agent when its chat is renamed.
      // An empty string means "no zone" (absent would mean "unchanged").
      if (agent) message.zone = agentZone(agent) ?? '';
      // A finished turn says when it finished and whether it failed, so the
      // office can label it "Done · 5m" or "Error" instead of a bare "Idle".
      if (agent && message.status === 'waiting' && message.sleeping !== true) {
        message.idleSince = agentIdleSince(agent) ?? Date.now();
        if (agent.turnErrored) message.error = true;
        // A turn that ended with background work still running is waiting on it.
        const background = agentBackgroundTasks(agent);
        if (background > 0) message.background = background;
      }
    }
    broadcast(message);
  };
}

// ── Finished turns ───────────────────────────────────────────

/**
 * When the agent last had a real exchange (ms since epoch) — the moment its
 * last turn ended, for an agent that is not in one. The provider reads it from
 * the transcript; a provider that cannot falls back to the file's mtime, which
 * also covers a transcript whose last exchange is not in the part that is read.
 * Undefined when the transcript is gone.
 */
function agentIdleSince(agent: AgentState): number | undefined {
  if (!agent.jsonlFile) return undefined;
  let mtime: number;
  try {
    mtime = fs.statSync(agent.jsonlFile).mtimeMs;
  } catch {
    return undefined;
  }
  let exchangedAt: number | undefined;
  try {
    exchangedAt = getHookProvider()?.lastActivityAt?.(agent.jsonlFile);
  } catch {
    exchangedAt = undefined;
  }
  return exchangedAt ?? mtime;
}

/** Background tasks the agent's session is still waiting on (0 when none, or
 *  when the provider cannot tell). */
function agentBackgroundTasks(agent: AgentState): number {
  if (!agent.jsonlFile) return 0;
  try {
    return getHookProvider()?.backgroundTasksRunning?.(agent.jsonlFile) ?? 0;
  } catch {
    return 0;
  }
}

/** For `existingAgents`: when each agent that is not mid-turn went quiet,
 *  which of them ended their last turn on an error, and how many background
 *  tasks each is waiting on. Keyed by agent id. */
export function agentIdleStates(store: AgentStateStore): {
  idleSince: Record<number, number>;
  errors: Record<number, boolean>;
  background: Record<number, number>;
} {
  const idleSince: Record<number, number> = {};
  const errors: Record<number, boolean> = {};
  const background: Record<number, number> = {};
  for (const [id, agent] of store) {
    if (agent.turnActive) continue;
    const since = agentIdleSince(agent);
    if (since !== undefined) idleSince[id] = since;
    if (agent.turnErrored) errors[id] = true;
    const running = agentBackgroundTasks(agent);
    if (running > 0) background[id] = running;
  }
  return { idleSince, errors, background };
}

// ── Session links ────────────────────────────────────────────

/** A link that opens the agent's session in its CLI's own app, when the
 *  provider has one. External agents only: an agent the office launched has a
 *  terminal here, which is where a click on it leads. */
export function agentLink(agent: AgentState): string | undefined {
  if (!agent.isExternal || !agent.jsonlFile) return undefined;
  const sessionId = path.basename(agent.jsonlFile, path.extname(agent.jsonlFile));
  try {
    return getHookProvider()?.sessionLink?.(sessionId);
  } catch {
    return undefined;
  }
}

/** Links of every agent that has one, keyed by agent id (for `existingAgents`). */
export function agentLinks(store: AgentStateStore): Record<number, string> {
  const links: Record<number, string> = {};
  for (const [id, agent] of store) {
    const link = agentLink(agent);
    if (link) links[id] = link;
  }
  return links;
}

// ── Project groups (zones) ───────────────────────────────────

/** What a rule's regex is tested against. */
type ZoneTarget = 'folder' | 'title';
type ZoneRule = [pattern: RegExp, zone: string, target: ZoneTarget];

/** A rule regex starting with this tests the conversation title instead of the folder. */
const TITLE_RULE_PREFIX = 'title:';

let zoneRules: ZoneRule[] = [];
let zoneRulesReadAt = 0;
/** Zones whose agents sleep at their desks instead of walking to a bed
 *  (zones.json `deskSleepZones`), read with the rules. */
let deskSleepZones = new Set<string>();

/**
 * The rules in ~/.pixel-agents/zones.json: `{ "rules": [[regex, zone], ...] }`.
 * Each regex is tested, case-insensitively, against the name of the agent's
 * transcript folder (the session's working directory as the CLI encodes it),
 * or, when it starts with "title:", against the conversation's title (so one
 * chat can be placed by renaming it, whatever folder it runs in). The first
 * match names the zone, which must be an Area label in the layout. No file, a
 * broken file or no match = no zone. Re-read at most every ZONES_CACHE_MS, so
 * edits apply without a restart.
 */
function readZoneRules(): ZoneRule[] {
  const now = Date.now();
  if (zoneRulesReadAt !== 0 && now - zoneRulesReadAt < ZONES_CACHE_MS) return zoneRules;
  zoneRulesReadAt = now;
  const rules: ZoneRule[] = [];
  const atDesk = new Set<string>();
  try {
    const file = path.join(os.homedir(), PIXEL_AGENTS_DIR, ZONES_FILE_NAME);
    const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
    const record =
      parsed && typeof parsed === 'object'
        ? (parsed as { rules?: unknown; deskSleepZones?: unknown })
        : undefined;
    if (Array.isArray(record?.deskSleepZones)) {
      for (const zone of record.deskSleepZones) {
        if (typeof zone === 'string') atDesk.add(zone);
      }
    }
    const list = record?.rules;
    if (Array.isArray(list)) {
      for (const rule of list) {
        if (!Array.isArray(rule) || typeof rule[0] !== 'string' || typeof rule[1] !== 'string') {
          continue;
        }
        try {
          const byTitle = rule[0].startsWith(TITLE_RULE_PREFIX);
          const source = byTitle ? rule[0].slice(TITLE_RULE_PREFIX.length) : rule[0];
          rules.push([new RegExp(source, 'i'), rule[1], byTitle ? 'title' : 'folder']);
        } catch {
          // an invalid regex skips its rule, not the file
        }
      }
    }
  } catch {
    // no file, or not JSON: no rules
  }
  zoneRules = rules;
  deskSleepZones = atDesk;
  return rules;
}

/** True when the agent's zone is listed in zones.json `deskSleepZones`: it
 *  shows "Zzz" in its own seat rather than walking to a bed. */
export function sleepsAtDesk(agent: AgentState): boolean {
  const zone = agentZone(agent); // reads the file (and deskSleepZones) when stale
  return zone !== undefined && deskSleepZones.has(zone);
}

/** The project group of an agent, or undefined when no rule matches. */
export function agentZone(agent: AgentState): string | undefined {
  const folder = agent.projectDir ? path.basename(agent.projectDir) : undefined;
  let title: string | undefined | null = null; // null = not read yet (read lazily, once)
  for (const [pattern, zone, target] of readZoneRules()) {
    if (target === 'title') {
      if (title === null) title = agentTitle(agent);
      if (title && pattern.test(title)) return zone;
    } else if (folder && pattern.test(folder)) {
      return zone;
    }
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
    // Idle time counts from the last real exchange, not from the file's mtime:
    // bookkeeping appended to an unused session must not make it look fresh.
    const mtime = agentIdleSince(agent);
    if (mtime === undefined) continue;
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
    } else if (idleMs > sleepAfterMs && agentBackgroundTasks(agent) === 0) {
      // Waiting on a background job is not asleep: a long job keeps it at its desk.
      store.broadcast({
        type: 'agentStatus',
        id,
        status: 'waiting',
        sleeping: true,
        ...(sleepsAtDesk(agent) ? { atDesk: true } : {}),
      });
    }
  }
  return remove;
}
