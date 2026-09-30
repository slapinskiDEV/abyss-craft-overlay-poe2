// Hotkey copy flow (spec 010): send the copy shortcut once, then wait briefly for the game to put the
// item on the clipboard. Bounded to one hotkey press — never continuous polling (SoT §16.2).
import type { ClipboardSnapshot } from '../preload/api-types';

export const COPY_WAIT_MS = 600;
export const COPY_POLL_MS = 15; // spec 016: the item shows at most 15 ms after the game copied it

export interface CopyFlowDeps {
  read: () => Promise<ClipboardSnapshot>;
  sendCopy: () => Promise<boolean>;
  sleep: (ms: number) => Promise<void>;
}

export interface CopyResult {
  snapshot: ClipboardSnapshot;
  /** The copy shortcut was sent (false where unsupported). */
  sent: boolean;
  /** The clipboard text changed within the bounded wait. */
  changed: boolean;
  /** Polls until the change or the end of the wait (spec 018 timings). */
  polls: number;
}

/** Like copyThenRead, with what happened; for the debug-report timings (spec 018). */
export async function copyThenReadDetailed(deps: CopyFlowDeps): Promise<CopyResult> {
  const before = await deps.read();
  if (!(await deps.sendCopy())) return { snapshot: before, sent: false, changed: false, polls: 0 };
  let polls = 0;
  for (let waited = 0; waited < COPY_WAIT_MS; waited += COPY_POLL_MS) {
    await deps.sleep(COPY_POLL_MS);
    polls += 1;
    const now = await deps.read();
    if (now.text !== before.text) return { snapshot: now, sent: true, changed: true, polls };
  }
  return { snapshot: await deps.read(), sent: true, changed: false, polls };
}

/** Returns the clipboard after the copy; unchanged text after the wait means nothing was copied. */
export async function copyThenRead(deps: CopyFlowDeps): Promise<ClipboardSnapshot> {
  return (await copyThenReadDetailed(deps)).snapshot;
}
