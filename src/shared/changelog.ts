// Release notes shown once after an update (SoT §16.8, spec 011). IDs only, oldest first; the texts
// live in the UI locale registry (namespace `changelog`), so every UI language has its own notes.
export const CHANGELOG_ENTRIES = ['2026-09-29', '2026-09-29b', '2026-09-29c', '2026-09-29d', '2026-09-30', '2026-09-30b', '2026-09-30c', '2026-09-30d', '2026-09-30e', '2026-09-30f', '2026-09-30g', '2026-09-30h', '2026-09-30i'] as const;
export type ChangelogEntryId = (typeof CHANGELOG_ENTRIES)[number];

export const LATEST_CHANGELOG_ENTRY: ChangelogEntryId = CHANGELOG_ENTRIES[CHANGELOG_ENTRIES.length - 1]!;

export const isChangelogEntry = (v: unknown): v is ChangelogEntryId => typeof v === 'string' && (CHANGELOG_ENTRIES as readonly string[]).includes(v);

/**
 * Entries the player has not seen, newest first. A fresh install sees none (main marks the latest
 * as seen before onboarding); a build older than the changelog sees only the latest entry.
 */
export function pendingChangelog(seen: string | null): ChangelogEntryId[] {
  if (seen === LATEST_CHANGELOG_ENTRY) return [];
  const index = isChangelogEntry(seen) ? CHANGELOG_ENTRIES.indexOf(seen) : CHANGELOG_ENTRIES.length - 2;
  return CHANGELOG_ENTRIES.slice(index + 1).reverse();
}
