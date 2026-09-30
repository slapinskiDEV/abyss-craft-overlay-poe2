# 011 — App update and release notes

**SoT refs:** §3.5 (0.2.8), §6.1, §16.4, §16.7, §16.8

## Goal

Players get new versions from inside the overlay: an "Update" button appears when a newer version
exists, one click downloads and installs it, and after the restart a small dialog lists what changed
in the overlay's UI language (EN/PL).

## In scope

- `src/main/app-update.ts`: the only runtime network module. `electron-updater` with a generic feed
  on the public releases repository (`releases/latest/download/latest.yml`). `autoDownload` and
  `autoInstallOnAppQuit` are off. Check 15 s after start and every 6 h while `checkForUpdates` is on.
  Only the packaged Windows build checks.
- Title-bar `UpdateButton`: hidden for `none`; "Update to X" (`available`), progress in MB
  (`downloading`; no percentages, the i18n gate rejects them as probability wording), "Installing…" (`ready`), "Update failed" (retry on click).
- Portable build (`PORTABLE_EXECUTABLE_DIR` set): the button opens the releases page.
- `src/shared/changelog.ts`: ordered entry IDs. Texts: UI namespace `changelog` per locale.
  `AppSettings.changelogSeen` records the last entry the player closed.
- CI: version `<major>.<minor>.<run number>`, stable artifact names, `latest.yml`, publishing to the
  public repository and syncing its README (`docs/releases-repo/`), gated on `RELEASES_TOKEN`.
- Bone selector lists only usable Bones (§16.4, 0.2.8); the incompatible/legacy toggle is removed.

## Out of scope

- Separate data-pack updates (§6.1), background downloads, delta updates beyond electron-updater's
  own blockmap handling, code signing.

## Interfaces / contracts

```ts
type UpdateStatus = { state: 'none' } | { state: 'available'; version; manual } |
  { state: 'downloading'; version; doneMb; totalMb } | { state: 'ready'; version } | { state: 'failed' };
OverlayApi.getUpdateStatus(): Promise<UpdateStatus>
OverlayApi.onUpdateStatus(cb): Unsubscribe
OverlayApi.startUpdate(): void
AppSettings.checkForUpdates: boolean      // default true
AppSettings.changelogSeen: string | null  // entry ID or null
pendingChangelog(seen): ChangelogEntryId[] // newest first
```

## Algorithm/design choice

- *Generic feed instead of the GitHub provider:* the GitHub provider derives versions from tag names
  and lists releases through the API; `releases/latest/download/` is a plain redirect and needs no
  API. Stable file names keep the README's direct download links valid.
- *Separate public releases repository:* players get a short download page and issue tracker, and
  a token inside the executable would leak. (The source repository was private when this was
  decided; it is public since 2026-09-30, and the split is kept.) CI publishes with a fine-grained token that has access to the public repository only;
  the token is passed only to the two publishing steps.
- *Silent install:* `quitAndInstall(true, true)` installs into the existing folder and restarts.
- *Changelog by entry ID, not by version:* the patch number is assigned by CI, so notes cannot be
  keyed by version in advance. A settings file older than the changelog shows the latest entry once;
  a fresh install marks it read before onboarding. After an update main opens the overlay once so
  the dialog is seen.

## Acceptance criteria

1. No newer version → no button. Newer version → "Update to X"; click → download progress → install
   and restart; a failed download can be retried.
2. After the restart the dialog shows the new entry in the UI language; closing it stores
   `changelogSeen`; it does not come back.
3. Fresh install: no dialog.
4. `checkForUpdates` off → no request.
5. Architecture test: `electron-updater` only in `app-update.ts`; only the releases URLs; no
   automatic download or install.

## Tests

`tests/main/main-modules.test.ts` (pending entries, settings), `tests/renderer/app.test.tsx`
(dialog, button), `tests/architecture/runtime-boundary.test.ts` (network boundary), manual:
`tests/manual/overlay/CHECKLIST.md` (update from build N to N+1 on Windows).

## Dependencies

001, 008.

## Unresolved items

None.
