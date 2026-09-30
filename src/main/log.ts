// Local diagnostic log (spec 018): what the overlay did around a hotkey press, so a problem that
// leaves the window unclickable can still be reported. Stays on this machine; never holds clipboard
// text. One file in userData/logs, rotated at LOG_MAX_BYTES.
import { appendFileSync, existsSync, mkdirSync, renameSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const LOG_MAX_BYTES = 512 * 1024;
let logFile: string | null = null;

export function initLog(dir: string): string {
  mkdirSync(dir, { recursive: true });
  logFile = join(dir, 'overlay.log');
  return dir;
}

/** Appends one line: ISO time, event name, optional JSON details. Never throws. */
export function log(event: string, details?: Record<string, unknown>): void {
  if (!logFile) return;
  try {
    if (existsSync(logFile) && statSync(logFile).size > LOG_MAX_BYTES) renameSync(logFile, `${logFile}.1`);
    appendFileSync(logFile, `${new Date().toISOString()} ${event}${details ? ` ${JSON.stringify(details)}` : ''}\n`);
  } catch {
    // A diagnostic log must never break the overlay.
  }
}
