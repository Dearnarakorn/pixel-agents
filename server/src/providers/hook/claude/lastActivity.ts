/**
 * When a Claude session last had a real exchange: the timestamp of the last
 * `user` or `assistant` record in its transcript.
 *
 * The file's modification time is NOT that. The CLI and the desktop app also
 * append bookkeeping records to a transcript (cost-state, tools-used, mode,
 * custom-title, last-prompt…), and they do it to sessions nobody is using —
 * switching account in the desktop app touched dozens of transcripts at once,
 * some last used months before. Judged by mtime, every one of them looked
 * active "a minute ago" and was adopted into the office.
 *
 * Reads only the tail of the file, and only when the file changed since the
 * last read (cached by size + mtime), so the periodic scans stay cheap.
 */

import * as fs from 'fs';

/** How much of the transcript's end is searched for the last exchange. Tool
 *  results can be large, so this is generous; a record longer than this is
 *  simply not found and the caller falls back to the file's mtime. */
const TAIL_BYTES = 512 * 1024;

const cache = new Map<string, { size: number; mtimeMs: number; at: number | undefined }>();

/** Milliseconds since epoch of the last user/assistant record, or undefined
 *  when the file is unreadable or its tail holds none. */
export function lastActivityAt(transcriptPath: string): number | undefined {
  let stat: fs.Stats;
  try {
    stat = fs.statSync(transcriptPath);
  } catch {
    cache.delete(transcriptPath);
    return undefined;
  }
  const cached = cache.get(transcriptPath);
  if (cached && cached.size === stat.size && cached.mtimeMs === stat.mtimeMs) return cached.at;

  let at: number | undefined;
  try {
    at = readLastExchange(transcriptPath, stat.size);
  } catch {
    at = undefined;
  }
  cache.set(transcriptPath, { size: stat.size, mtimeMs: stat.mtimeMs, at });
  return at;
}

function readLastExchange(transcriptPath: string, size: number): number | undefined {
  const length = Math.min(size, TAIL_BYTES);
  const buffer = Buffer.alloc(length);
  const fd = fs.openSync(transcriptPath, 'r');
  try {
    fs.readSync(fd, buffer, 0, length, size - length);
  } finally {
    fs.closeSync(fd);
  }
  const lines = buffer.toString('utf8').split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    // Cheap filter before parsing: most tail lines are bookkeeping.
    if (!line.includes('"type":"user"') && !line.includes('"type":"assistant"')) continue;
    let record: unknown;
    try {
      record = JSON.parse(line);
    } catch {
      continue; // the cut-off first line of the tail, or a line mid-write
    }
    if (typeof record !== 'object' || record === null) continue;
    const { type, timestamp, isMeta } = record as Record<string, unknown>;
    if ((type !== 'user' && type !== 'assistant') || isMeta === true) continue;
    const at = typeof timestamp === 'string' ? Date.parse(timestamp) : NaN;
    if (!Number.isNaN(at)) return at;
  }
  return undefined;
}
