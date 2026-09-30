// Hotkey copy flow (spec 010): send the copy shortcut once, then wait briefly for the game to put the
// item on the clipboard. Bounded to one hotkey press — never continuous polling (SoT §16.2).
import type { ClipboardSnapshot } from '../preload/api-types';

export const COPY_WAIT_MS = 600;
export const COPY_POLL_MS = 15; // spec 016: the item shows at most 15 ms after the game copied it

export interface CopyFlowDeps {
  read: () => Promise<ClipboardSnapshot>;
  sendCopy: () => Promise<boolean>;
  sleep: (ms: number) => Promise<void>;
  /** Clipboard sequence number without opening the clipboard; null where unsupported (spec 018). */
  sequence?: () => number | null;
  /** Wall clock in ms; the wait is bounded by time, not by the number of reads (spec 018). */
  now?: () => number;
}

export interface CopyResult {
  snapshot: ClipboardSnapshot;
  /** The copy shortcut was sent (false where unsupported). */
  sent: boolean;
  /** The clipboard changed within the bounded wait. */
  changed: boolean;
  /** Checks until the change or the end of the wait. */
  polls: number;
  /** ms spent sending the shortcut, waiting for the change, and reading clipboard text. */
  sendMs: number;
  waitMs: number;
  readMs: number;
}

/** Sequence-number polls; cheap, so they may be frequent. */
export const SEQUENCE_POLL_MS = 10;
/** The game may empty the clipboard before writing the item: re-read a few times while it is empty. */
const EMPTY_RETRIES = 5;

/**
 * Sends the copy shortcut once and waits at most COPY_WAIT_MS (wall clock) for the game's copy.
 * With a sequence number (Windows) the clipboard text is read only after it changed; without one,
 * the text is polled every COPY_POLL_MS (spec 016 behavior).
 */
export async function copyThenReadDetailed(deps: CopyFlowDeps): Promise<CopyResult> {
  const now = deps.now ?? (() => Date.now());
  let readMs = 0;
  const read = async () => {
    const t = now();
    const snap = await deps.read();
    readMs += now() - t;
    return snap;
  };
  const seq0 = deps.sequence?.() ?? null;
  const before = seq0 === null ? await read() : null;
  const t0 = now();
  if (!(await deps.sendCopy())) return { snapshot: before ?? (await read()), sent: false, changed: false, polls: 0, sendMs: now() - t0, waitMs: 0, readMs };
  const sentAt = now();
  const sendMs = sentAt - t0;
  let polls = 0;

  if (seq0 !== null && deps.sequence) {
    while (now() - sentAt < COPY_WAIT_MS) {
      await deps.sleep(SEQUENCE_POLL_MS);
      polls += 1;
      if (deps.sequence() === seq0) continue;
      const waitMs = now() - sentAt;
      let snap = await read();
      for (let i = 0; i < EMPTY_RETRIES && snap.text === ''; i += 1) {
        await deps.sleep(COPY_POLL_MS);
        snap = await read();
      }
      return { snapshot: snap, sent: true, changed: true, polls, sendMs, waitMs, readMs };
    }
    return { snapshot: await read(), sent: true, changed: false, polls, sendMs, waitMs: now() - sentAt, readMs };
  }

  const previous = before as ClipboardSnapshot;
  while (now() - sentAt < COPY_WAIT_MS) {
    await deps.sleep(COPY_POLL_MS);
    polls += 1;
    const snap = await read();
    if (snap.text !== previous.text) return { snapshot: snap, sent: true, changed: true, polls, sendMs, waitMs: now() - sentAt, readMs };
  }
  return { snapshot: await read(), sent: true, changed: false, polls, sendMs, waitMs: now() - sentAt, readMs };
}

/** Returns the clipboard after the copy; unchanged text after the wait means nothing was copied. */
export async function copyThenRead(deps: CopyFlowDeps): Promise<ClipboardSnapshot> {
  return (await copyThenReadDetailed(deps)).snapshot;
}
