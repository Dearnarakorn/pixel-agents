import { useEffect, useState } from 'react';

import { OVERVIEW_OTHER_ZONE, OVERVIEW_REFRESH_MS } from '../constants.js';
import {
  type AgentStatusKind,
  agentStatusKind,
  STATUS_KIND_ORDER,
} from '../office/agentStatusKind.js';
import type { OfficeState } from '../office/engine/officeState.js';
import type { ToolActivity } from '../office/types.js';
import { PixelIcon } from './ui/PixelIcon.js';
import { PixelText } from './ui/PixelText.js';

interface OverviewPanelProps {
  officeState: OfficeState;
  agents: number[];
  agentTools: Record<number, ToolActivity[]>;
  /** A row pressed: select the agent, as its card would. */
  onSelectAgent: (id: number) => void;
}

/** Per status: the label in the panel and its colour (theme tokens). */
const KIND_STYLE: Record<AgentStatusKind, { label: string; text: string }> = {
  attention: { label: 'Needs you', text: 'text-status-permission' },
  error: { label: 'Error', text: 'text-status-error' },
  working: { label: 'Working', text: 'text-accent-bright' },
  done: { label: 'Done', text: 'text-status-success' },
  idle: { label: 'Idle', text: 'text-text-muted' },
  sleeping: { label: 'Asleep', text: 'text-text-muted' },
};

/** The summary chips at the top, in this order. */
const SUMMARY_KINDS: AgentStatusKind[] = ['attention', 'error', 'working', 'done', 'sleeping'];

interface Row {
  id: number;
  title: string;
  zone: string;
  kind: AgentStatusKind;
  idleSince: number | undefined;
}

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

/** "5m", "3h", "2d": how long ago, for done and asleep rows. */
function ago(ms: number): string {
  const minutes = Math.floor(Math.max(0, ms) / MS_PER_MINUTE);
  if (minutes < MINUTES_PER_HOUR) return `${minutes}m`;
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  if (hours < HOURS_PER_DAY) return `${hours}h`;
  return `${Math.floor(hours / HOURS_PER_DAY)}d`;
}

/**
 * The boss's view: every agent in the office at a glance, grouped by project
 * (the server's zone; agents without one under "Other"), what needs you first.
 * Office state is imperative, so the panel re-reads it on a short timer while
 * it is open.
 */
export function OverviewPanel({ officeState, agents, agentTools, onSelectAgent }: OverviewPanelProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), OVERVIEW_REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  const rows: Row[] = [];
  for (const id of agents) {
    const ch = officeState.characters.get(id);
    if (!ch || ch.isSubagent || ch.leadAgentId !== undefined) continue;
    const idleSince = officeState.idleSince.get(id);
    rows.push({
      id,
      title: ch.title || ch.directoryName || `Agent ${id}`,
      zone: ch.zone || OVERVIEW_OTHER_ZONE,
      kind: agentStatusKind(ch, agentTools[id], officeState.errored.has(id), idleSince),
      idleSince,
    });
  }

  const counts = new Map<AgentStatusKind, number>();
  for (const row of rows) counts.set(row.kind, (counts.get(row.kind) ?? 0) + 1);

  const zones = new Map<string, Row[]>();
  for (const row of rows) {
    const list = zones.get(row.zone) ?? [];
    list.push(row);
    zones.set(row.zone, list);
  }
  for (const list of zones.values()) {
    list.sort(
      (a, b) =>
        STATUS_KIND_ORDER[a.kind] - STATUS_KIND_ORDER[b.kind] ||
        (b.idleSince ?? 0) - (a.idleSince ?? 0),
    );
  }
  // Projects in name order, "Other" last; a project with something needing you rises to the top.
  const zoneNames = [...zones.keys()].sort((a, b) => {
    const urgent = (z: string) =>
      zones.get(z)!.some((r) => r.kind === 'attention' || r.kind === 'error') ? 0 : 1;
    if (urgent(a) !== urgent(b)) return urgent(a) - urgent(b);
    if (a === OVERVIEW_OTHER_ZONE) return 1;
    if (b === OVERVIEW_OTHER_ZONE) return -1;
    return a.localeCompare(b);
  });

  return (
    <div
      role="region"
      aria-label="Overview of all agents"
      className="absolute top-8 left-64 z-10 w-320 max-h-[70vh] flex flex-col bg-bg border-2 border-border shadow-pixel text-text"
    >
      <div className="flex flex-wrap gap-x-12 gap-y-4 px-10 py-8 border-b-2 border-border">
        {SUMMARY_KINDS.map((kind) => (
          <span key={kind} className={`flex items-center gap-4 text-sm ${KIND_STYLE[kind].text}`}>
            <PixelText text={String(counts.get(kind) ?? 0)} />
            {KIND_STYLE[kind].label}
          </span>
        ))}
      </div>
      <div className="overflow-y-auto">
        {rows.length === 0 && (
          <p className="px-10 py-8 text-sm text-text-muted">No agents in the office.</p>
        )}
        {zoneNames.map((zone) => (
          <section key={zone} className="py-4">
            <h3 className="px-10 py-2 text-xs text-text-muted">
              {zone} · {zones.get(zone)!.length}
            </h3>
            {zones.get(zone)!.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => onSelectAgent(row.id)}
                title={row.title}
                className="flex items-center gap-6 w-full px-10 py-3 bg-transparent border-0 rounded-none text-left cursor-pointer hover:bg-btn-bg"
              >
                <span className={`flex shrink-0 ${KIND_STYLE[row.kind].text}`}>
                  <PixelIcon name="dot" />
                </span>
                <span className="flex-1 min-w-0 truncate text-sm">{row.title}</span>
                <span className={`shrink-0 text-xs ${KIND_STYLE[row.kind].text}`}>
                  {(row.kind === 'done' || row.kind === 'sleeping') && row.idleSince !== undefined ? (
                    <PixelText text={ago(now - row.idleSince)} />
                  ) : (
                    KIND_STYLE[row.kind].label
                  )}
                </span>
              </button>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
