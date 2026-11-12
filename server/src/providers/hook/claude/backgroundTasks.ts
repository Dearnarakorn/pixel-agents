/**
 * How many background tasks a Claude session started and has not heard back
 * from: a command run with `run_in_background` (its tool result reads
 * "Command running in background with ID: <id>") with no completion notice
 * (`<task-notification>` naming `<task-id><id></task-id>`) after it.
 *
 * A turn that ends while such a task runs is not done: the session is waiting
 * for it, and the notice will start a new turn. Background *agents* are a
 * different thing (their own Sub-agent characters, see backgroundSpawns.ts).
 *
 * Reads the transcript's tail only, and only when the file changed (cached by
 * size + mtime). A launch older than the tail is not seen, so is not counted.
 */

import * as fs from 'fs';

const TAIL_BYTES = 512 * 1024;
const LAUNCH = /Command running in background with ID: ([A-Za-z0-9_-]+)/g;
const NOTICE_TASK_ID = /<task-id>([A-Za-z0-9_-]+)<\/task-id>/g;

const cache = new Map<string, { size: number; mtimeMs: number; running: number }>();

export function backgroundTasksRunning(transcriptPath: string): number {
  let stat: fs.Stats;
  try {
    stat = fs.statSync(transcriptPath);
  } catch {
    cache.delete(transcriptPath);
    return 0;
  }
  const cached = cache.get(transcriptPath);
  if (cached && cached.size === stat.size && cached.mtimeMs === stat.mtimeMs) return cached.running;

  let running = 0;
  try {
    running = countRunning(readTail(transcriptPath, stat.size));
  } catch {
    running = 0;
  }
  cache.set(transcriptPath, { size: stat.size, mtimeMs: stat.mtimeMs, running });
  return running;
}

function readTail(transcriptPath: string, size: number): string {
  const length = Math.min(size, TAIL_BYTES);
  const buffer = Buffer.alloc(length);
  const fd = fs.openSync(transcriptPath, 'r');
  try {
    fs.readSync(fd, buffer, 0, length, size - length);
  } finally {
    fs.closeSync(fd);
  }
  return buffer.toString('utf8');
}

function countRunning(tail: string): number {
  const launched = new Set<string>();
  for (const line of tail.split('\n')) {
    // A launch is a tool result (a user record). Only those lines count, so a
    // message that merely quotes the phrase (this file's own source, say) does not.
    if (line.includes('"tool_result"')) {
      for (const m of line.matchAll(LAUNCH)) launched.add(m[1]);
    }
    // A completion notice: delivered as a queue-operation, an attachment, or
    // the user record the CLI writes for it. Any of them ends the task.
    if (line.includes('<task-notification>')) {
      for (const m of line.matchAll(NOTICE_TASK_ID)) launched.delete(m[1]);
    }
  }
  return launched.size;
}
