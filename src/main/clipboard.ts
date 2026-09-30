// Clipboard access (SoT §3.1): read once per explicit invocation; write only the debug report.
import { clipboard } from 'electron';
import type { ClipboardSnapshot } from '../preload/api-types';

export async function readClipboardSnapshot(): Promise<ClipboardSnapshot> {
  const text = await clipboard.readText();
  return { text, readAt: new Date().toISOString() };
}

/** The only clipboard write in the app: app-generated debug report text (SoT §15.3). */
export async function writeDebugReportToClipboard(text: string): Promise<void> {
  await clipboard.writeText(text);
}
