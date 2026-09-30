// Local diagnostic log (spec 018): what the overlay did around a hotkey press, so a problem that
// leaves the window unclickable can still be reported. Stays on this machine; never holds clipboard
// text. One file in userData/logs, rotated at LOG_MAX_BYTES. Writes are queued and asynchronous: a
// slow disk or a virus scanner must never block the main thread (follow-up 3).
import { appendFile, rename, stat } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

export const LOG_MAX_BYTES = 512 * 1024;
let logFile: string | null = null;
let pending: string[] = [];
let writing: Promise<void> | null = null;

export function initLog(dir: string): string {
  mkdirSync(dir, { recursive: true });
  logFile = join(dir, 'overlay.log');
  return dir;
}

async function drain(file: string): Promise<void> {
  while (pending.length > 0) {
    const lines = pending.join('');
    pending = [];
    try {
      const size = await stat(file).then((s) => s.size).catch(() => 0);
      if (size > LOG_MAX_BYTES) await rename(file, `${file}.1`);
      await appendFile(file, lines);
    } catch {
      // A diagnostic log must never break the overlay.
    }
  }
}

/** Queues one line: ISO time, event name, optional JSON details. Never throws, never blocks. */
export function log(event: string, details?: Record<string, unknown>): void {
  if (!logFile) return;
  pending.push(`${new Date().toISOString()} ${event}${details ? ` ${JSON.stringify(details)}` : ''}\n`);
  const file = logFile;
  writing ??= drain(file).finally(() => {
    writing = null;
  });
}

/** Resolves when every queued line is written (tests, quit). */
export async function flushLog(): Promise<void> {
  while (writing) await writing;
}
