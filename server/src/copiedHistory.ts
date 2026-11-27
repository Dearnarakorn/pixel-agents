/**
 * A forked session's transcript starts with a copy of its parent's records, each
 * still carrying the parent's session id. They are the parent's history, not
 * anything this session did: read as its own, a fork nobody has typed in showed
 * the parent's last tool as running ("Using …") and the parent's incoming work
 * ("from Engineer") for ever. A session's own records carry the id its
 * transcript file is named after.
 */

import * as path from 'path';

import { isRecord } from '../../core/src/isRecord.js';

const SESSION_FILE_STEM = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True when `record` in `jsonlFile` belongs to another session (a fork's copied history).
 *  Only top-level session transcripts (<uuid>.jsonl) are judged: a background agent's
 *  transcript (agent-<id>.jsonl) carries its lead's session id on every record. */
export function isCopiedRecord(jsonlFile: string | undefined, record: unknown): boolean {
  if (!jsonlFile || !isRecord(record)) return false;
  const sessionId = record.sessionId;
  if (typeof sessionId !== 'string' || !sessionId) return false;
  const stem = path.basename(jsonlFile, '.jsonl');
  if (!SESSION_FILE_STEM.test(stem)) return false;
  return sessionId.toLowerCase() !== stem.toLowerCase();
}
