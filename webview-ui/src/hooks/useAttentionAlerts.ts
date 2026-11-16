import { useEffect, useRef } from 'react';

import { ATTENTION_CHECK_MS } from '../constants.js';
import { showDesktopNotification } from '../desktopNotify.js';
import { type AgentStatusKind, agentStatusKind } from '../office/agentStatusKind.js';
import type { OfficeState } from '../office/engine/officeState.js';
import type { ToolActivity } from '../office/types.js';
import { openSessionLink } from '../sessionLink.js';

const ALERT_KINDS: ReadonlySet<AgentStatusKind> = new Set(['attention', 'error']);
const ALERT_TEXT: Partial<Record<AgentStatusKind, string>> = {
  attention: 'Needs you',
  error: 'Error',
};

/**
 * Tells you about agents that need you even while the office is out of sight:
 * the tab title counts agents needing you or in error ("(2) Pixel Agents"),
 * and, when switched on in Settings, a desktop notification pops when an agent
 * starts needing you or fails (not on page load). Pressing the notification
 * selects the agent and opens its session in its app, like a second click.
 * Office state is imperative, so this re-reads it on a short timer.
 */
export function useAttentionAlerts(
  officeState: OfficeState,
  agents: number[],
  agentTools: Record<number, ToolActivity[]>,
  onSelectAgent: (id: number) => void,
): void {
  // Latest inputs for the timer, without restarting it on every render.
  const inputs = useRef({ agents, agentTools, onSelectAgent });
  useEffect(() => {
    inputs.current = { agents, agentTools, onSelectAgent };
  });
  const previous = useRef<Map<number, AgentStatusKind> | null>(null);

  useEffect(() => {
    const baseTitle = document.title;
    const check = () => {
      const { agents: ids, agentTools: tools, onSelectAgent: select } = inputs.current;
      const kinds = new Map<number, AgentStatusKind>();
      for (const id of ids) {
        const ch = officeState.characters.get(id);
        if (!ch || ch.isSubagent || ch.leadAgentId !== undefined) continue;
        kinds.set(
          id,
          agentStatusKind(
            ch,
            tools[id],
            officeState.errored.has(id),
            officeState.idleSince.get(id),
            officeState.backgroundTasks.get(id) ?? 0,
          ),
        );
      }

      let alerting = 0;
      for (const kind of kinds.values()) if (ALERT_KINDS.has(kind)) alerting += 1;
      const title = alerting > 0 ? `(${alerting}) ${baseTitle}` : baseTitle;
      if (document.title !== title) document.title = title;

      // The first pass only records: no burst of notifications on page load.
      const before = previous.current;
      previous.current = kinds;
      if (!before) return;
      for (const [id, kind] of kinds) {
        if (!ALERT_KINDS.has(kind) || before.get(id) === kind) continue;
        const ch = officeState.characters.get(id);
        const name = ch?.title || ch?.directoryName || `Agent ${id}`;
        showDesktopNotification(name, ALERT_TEXT[kind] ?? kind, `pixel-agents-${id}`, () => {
          select(id);
          const link = officeState.characters.get(id)?.link;
          if (link) openSessionLink(link);
        });
      }
    };
    check();
    const timer = setInterval(check, ATTENTION_CHECK_MS);
    return () => {
      clearInterval(timer);
      document.title = baseTitle;
    };
  }, [officeState]);
}
