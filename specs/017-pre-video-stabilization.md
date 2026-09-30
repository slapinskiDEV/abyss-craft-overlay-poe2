# 017 — Stabilization before the public video

**SoT refs:** §1.1, §3.1, §3.5, §16.2–16.4, §16.7, §18.6, §19.1, §19.3, §19.4
**Status:** draft, open. Nothing in this spec changes a mechanic or user-visible semantics; items
that would are listed under "Maintainer decisions" and need an SoT change first.

## Goal

Before the YouTube walkthrough makes the overlay public to a wide audience, the app must not end up
in a state the player cannot leave without restarting it (blank window, lost tray icon, stuck
filter, crash dialog). Releases to players must be deliberate, and the build shown in the video must
be the one players download.

## Source

Code review of 2026-09-30 (main process, renderer, engine/parser), `npm audit` (0
vulnerabilities), Electron security settings (sandbox, context isolation, CSP, navigation blocked
— fine). Each item below was confirmed in the code; file:line refer to commit `680fa7c`.

## In scope

### A. Main process (`src/main/`)

| ID | Severity | Problem | Fix |
|---|---|---|---|
| A1 | **done** | `main.ts:104` drops the `Tray` returned by `createTray`; it can be garbage-collected and the icon disappears. The tray is the only way to quit and the only way back when the hotkey failed. | Keep it in a module-level `let tray`. |
| A2 | **done** | `settings.ts:41-42` `writeFileSync` + `renameSync` without try/catch, called from the 400 ms bounds timer. On Windows antivirus/OneDrive often holds the file (EPERM/EBUSY) → "A JavaScript error occurred in the main process". | Catch, log, retry once on the next write; keep memory and disk consistent. |
| A3 | **done** | `settings.ts:32-33`: if the settings file cannot be read, the `.bak` copy fails too and the constructor throws inside the `void`ed `whenReady` (`main.ts:92`). Result: a process with no window, tray or hotkey that still holds the single-instance lock. | Catch the backup copy; `.catch` on `whenReady` shows an error dialog and exits. |
| A4 | **done** | `main.ts:22` `app.quit()` for a second instance does not stop the `whenReady` body: a second copy may create a window/tray, try the hotkey and write `settings.json`. | `app.exit(0)` / early return when the lock is not held. |
| A5 | **done** | No `render-process-gone` handler: a renderer crash leaves a blank overlay. | Reload the window (at most a few times in a row). |
| A6 | **done** | `main.ts:80-89` copy-flow promise without `.catch` (unhandled rejection during quit). | Add `.catch` that clears `copyBusy`. |
| A7 | **done** | Startup hotkey registration result is ignored (`main.ts:108`); a conflict at launch is silent. | Push the failure to the renderer and show the existing hotkey error. |
| A8 | **done** | "Reset window position" exists only inside the overlay; an off-screen window (monitor removed) cannot be recovered. | Add it to the tray menu. |
| A9 | **done (kept, documented)** | `copy-shortcut.ts:21-33` releases Shift (old `Ctrl+Shift+D`); with `Alt+T` it injects `Alt up` while Alt is still held, and a custom hotkey with other modifiers adds them on top of `Ctrl+Alt+C`. SoT §3.1 requires releasing the held hotkey modifier. | Release the modifiers of the configured accelerator; update comments and spec 010. Manual test: hold Alt+T. |

### B. Renderer (`src/renderer/`)

| ID | Severity | Problem | Fix |
|---|---|---|---|
| B1 | **done** | No React error boundary (`main.tsx:11-15`); parse/evaluate run during render (`Workspace.tsx:63`, `:84-87`) and `diagnostic.ts:22` throws on an unregistered code. Any throw → blank overlay until restart. | Error boundary around the workspace with a translated fallback, "Read clipboard again" and "Copy debug report", reset when a new clipboard text arrives. |
| B2 | **done** | Category filter survives view switches and new items (`workspace.ts:47`), but chips are built only from the current view (`ModifierPanel.tsx:48`): a selected chip can vanish and leave "No modifiers match" with no way to turn it off. Min/max level carries over hidden in "More filters". | Drop categories not offered in the current view before filtering; reset level filters on a new item or show them as active. |
| B3 | **done** | `rows.ts:139-146` `POOL_NAMES` hard-codes pool names in the renderer (CLAUDE.md guardrail 2, SoT §16.4); `ModifierPanel.tsx:49` falls back to the raw id. | Serve the names from the data pack / game-term provider with provenance. |
| B4 | **done** | Startup chain `App.tsx:31` has no `.catch`; a rejected IPC call leaves `null` forever. Same pattern in `Workspace.tsx:54,61,96`, `SettingsPanel.tsx:56`, `UpdateButton.tsx:10`. | Catch and show the existing blocking-error block. |
| B5 | **done** | `ModifierPanel.tsx:135` cuts the list at 300 rows while the count shows all. | Translated "showing 300 of N — refine the filter" note. |
| B6 | **done** | Branch coverage badge `{{count}}/{{of}}` (`:164`) has no label and can read like odds (SoT §16.5, §17). | Add a label/title "in N of M removal outcomes". |
| B7 | **done** | `buildRows`/`availableCategories` re-run on every keystroke; `copied` state never resets. | `useMemo`; reset `copied` after a few seconds. |

### C. Engine and parser (`src/domain/`, `src/parser/`)

Suite state: 240 tests green, none skipped. Probes were throwaway scripts outside the repo.

| ID | Severity | Problem | Fix |
|---|---|---|---|
| C1 | **done** | `adapter.ts:260-275` `readNormalAffixes` walks every split of the lines into affixes without memoization; the `splits.length > 16` cap only counts successful splits. Probe: two-line hybrid affixes (each line also matching a mod alone) followed by one unrecognized line: 5 hybrids 0.36 s, 6 → 1.2 s, 8 → 14 s, 10 → 163 s. It runs synchronously in the renderer (`Workspace.tsx:62`), so the overlay freezes. | Memoize candidates per (start, end) range and cap the total number of attempts; on the cap return the existing `AFFIX_AMBIGUOUS`. |
| C2 | **done** | `adapter.ts:112` `plausible` accepts any `desecrated_exclusive` mod of any base and any regular mod of the domain, without the spawn-weight / applicability check of spec 004 step 7. Probe: a Body Armour line matching only a mace-only Amanamu exclusive → `exclusiveMatch` (`:127`) → `existingDesecration: 'present'` → `ITEM_ALREADY_DESECRATED` → exact check and base pool `invalid`. An `invalid` from a mod that cannot exist on the base breaks guardrail 3. | Done for exclusives: a candidate exclusive must be spawnable on the base tags (or match the Otherworldly jewellery classes), the same rule as the engine's pool. *Design choice:* regular rows stay domain-wide, because the Mark and other non-rolling regular rows have zero ordinary weight but occur on items; tightening them would lose Mark detection. |
| C3 | **done** | Unidentified rare parses with `confidence: 'full'` and 0 affixes; `affixSlots` (`slots.ts:21-35`) reports 3/3 free on both sides and `defaultSides` uses it. `unidentified` and `mirrored` are parsed but read nowhere in `src/domain` or `src/renderer`. | Done: SoT 0.2.14 adds U-015; unidentified → slots `undetermined` (`UNIDENTIFIED`); unidentified or mirrored → exact check `unknown` (`ITEM_STATE_UNDOCUMENTED`), never `invalid`; base pool unchanged. |
| C4 | **done** | `grammar.ts:50` advanced-block header regex is quadratic and is tested on every body line. Probe: a 32k-char line `{ a — a — …` without closing brace → 6 s. | Cap the tested line length (e.g. 500 chars) or make the pattern parts non-overlapping. |
| C5 | **done** | Normal copy records "Desecrated Prefix/Suffix" placeholders (`adapter.ts:328`) but `affixSlots` does not count them: one extra free slot on that side (labelled `recognized_only`). | Count seen Unrevealed placeholders as used. |

Checked and fine: CRLF/NBSP/zero-width normalization; empty, whitespace-only and 5 MB text →
`NOT_A_POE2_ITEM` without throwing; German text → `UNSUPPORTED_CLIPBOARD_LOCALE`; notes/price
lines; corrupted, magic, normal, unique handling; Ancient floor from pack data with highest-tier
fallback; Gnawed limit; Lich Omen/Bone family rules and U-013; Putrefaction regular sources only;
side Omen conflict; U-008, U-012; fractured affixes excluded from removal branches; base pool never
`final` and never uses the Mark floor; Mark detected by mod ID; `lichPoolConflict` rows excluded;
full evaluation 20–40 ms.

Still required regardless of the review: parser and evaluation never throw on arbitrary clipboard
text (SoT §9.4, §15.3) — a fuzz test pins it (see Tests).

### D. Release process

| ID | Problem | Fix |
|---|---|---|
| D1 | **Done (2026-09-30).** Every push to `master` published a player release; with a public repo every merged PR would update all players. | Push → test build only (pre-release in the source repository, not "latest"). Players get a build only from `gh workflow run "Windows build" -f publish=true`; that run also tags the commit `v<version>`. Version stays `<major>.<minor>.<run number>` so it only grows. |
| D2 | The build shown in the video must be the one players get. | Tag the video build; no player release during recording and editing except fixes from this spec. |
| D3 | **Done.** Releases README has no prominent download block. | Same hero as the source README (icon via absolute URL, big DOWNLOAD / POBIERZ, installer button), EN + PL. |
| D4 | **Done.** Bug reports from viewers arrive incomplete. | Issue templates: wrong modifier (debug report required), bug, clipboard fixture. |

### E. Data

| ID | Problem | Fix |
|---|---|---|
| E1 | Pack from RePoE 4.5.5.2 (game 0.5.5, 2026-09-26). | `npm run data:update` right before the video build; review the semantic diff and golden pools (release checklist step 2). |
| E2 | 13 Mace/Staff rows with two Lich tags excluded from forced-Lich pools (`data-source/reports/2026-09-26-4.5.5.2/audit-report.json`). | Maintainer review; stays excluded (fail closed) until then. |

### F. Manual validation (maintainer, Windows)

| ID | What | Where |
|---|---|---|
| F1 | Full smoke run on the tagged build, recorded as `tests/manual/overlay/<date>.md` (no run is recorded yet). | `tests/manual/overlay/CHECKLIST.md` |
| F2 | Update from the previous release to the tagged one (installer), release notes shown once. | same |
| F3 | Windowed Fullscreen, DPI 100/125/150 %, second monitor, hotkey conflicts with common tools (e.g. Exiled Exchange 2). | SoT §19.3 |
| F4 | Holding `Alt+T` longer than key-repeat does not type `t` in the game (A9). | manual |
| F5 | Verbatim EN clipboard fixtures (normal + advanced copy) for the SoT §19.1 list; gate for the video (decision 2). | `tests/fixtures/clipboard/en/`, `docs/HANDOFF.md` step 2 |

## Maintainer decisions (2026-09-30)

The maintainer asked to follow the recommendations below.

1. **App ID — decided, done.** `appId: com.slapinskidev.poe2-abyss-overlay` (was the provisional
   `dev.local.poe2-abyss-overlay`, SoT §1.1). The NSIS GUID is pinned (`nsis.guid:
   aeabca64-c17d-5a17-8161-b22f08656548`, derived from the old ID), so existing installs keep their
   uninstall entry and update in place. Settings live under the product name, not the app ID, and
   are kept. Product name unchanged. To verify manually (F2): update an installed 0.4.x to the
   first build with the new ID → one entry in "Installed apps", settings kept.
2. **Clipboard fixtures before the video — decided.** The video is recorded after the SoT §19.1
   fixtures are captured and the item-specific pool works, so it does not go stale. Fixture capture
   is therefore a gate for the video (F5).
3. **Code signing — decided: not for this release, and no paid signing (2026-09-30).** The build
   stays unsigned (SoT §19.4); the video and both READMEs show the SmartScreen step "More info → Run
   anyway". slapinskiDEV has under three years of tax history, so Azure Artifact Signing is not
   available; paid OV certificates (e.g. Certum) were declined. Free option to consider: SignPath
   Foundation (publisher shown as "SignPath Foundation", manual approval per release, MFA; ask
   whether the bundled GGG data pack is acceptable under its "no proprietary components" rule).
4. **Dependabot — decided, done.** Vulnerability alerts and security update PRs on; version
   update PRs off (no `dependabot.yml`). With D1 a merged Dependabot PR is not released to players
   until a publish run.

## Out of scope

- New mechanics, U-item resolution without Well of Souls evidence, probabilities, trade link
  (spec 013), new locales.
- Changing the runtime boundary (SoT §3.1): no keyboard hooks, no window inspection.

## Acceptance criteria

1. All "should-fix" items (A1–A4, B1–B3, C1–C3) fixed, each with a test.
2. Forced faults do not leave a dead app: throwing parser/evaluation → error fallback, not a blank
   window; unwritable settings file → no crash dialog; unreadable settings file → error dialog and
   exit; second instance → exits without window or tray; renderer crash → reload.
3. After any filter combination and a new item, the list is either non-empty or the active filters
   that empty it are visible and removable.
4. No PoE2 entity or pool names hard-coded in `src/renderer/` (renderer catalog guard covers pool
   names).
5. D1 in place: a push without a tag produces no release in the releases repository.
6. `npm run verify:release` green on the tagged build; F1–F4 recorded.
7. Maintainer decisions recorded (done, see above); F5 fixtures captured before recording.

## Tests

- `tests/main/main-modules.test.ts`: settings write failure, read failure, single-instance path,
  key sequence for several accelerators (A2–A4, A9).
- `tests/renderer/app.test.tsx`: error boundary fallback and reset; stale category/level filters;
  truncation note; startup IPC rejection (B1, B2, B4, B5).
- `tests/architecture/renderer-catalog-guard.test.ts`: extended to pool names (B3).
- Parser tests: fuzz over odd clipboard inputs never throws; hybrid-heavy normal copy with an
  unrecognized line parses under 100 ms (C1); off-base exclusive line does not set `present` (C2);
  unidentified rare → slots `undetermined` (C3); long unterminated header line stays fast (C4).
- Manual: F1–F4.

## Dependencies

008, 010, 011, 015, 016.

## Unresolved items

- U-015 (SoT 0.2.14): unidentified and mirrored items; resolve with a Well of Souls check (does a
  Bone work on them?) before changing the fail-closed behavior.
- U-011/U-014 decide whether the item-specific pool exists for the video (decision 2, F5).
