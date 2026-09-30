# 013 — Trade search link (planned, post-MVP)

**Status:** planned. **Not implemented.** Maintainer decision 2026-09-29: added later as an extra
feature. Implementation needs an SoT change first (SoT §2.3 lists "Trade API searches" as not in MVP;
§2.4 records this plan).

**SoT refs:** §2.3, §2.4 (0.2.10), §3.1, §3.5, §6.1

## Goal

From the item preview, open the official PoE2 trade site in the player's browser with a search
prefilled for the copied base and the picked modifier, so the player can look for similar items.

## Decided

- Only a **link opened in the default browser** (`shell.openExternal`). The overlay does not call the
  trade API at runtime, does not log in, and shows no prices.
- No in-game search: PoE2 has no in-game search that accepts pasted item text (maintainer confirmed).
- Buttons appear only when every part of the query is backed by data; otherwise the button is
  disabled with a reason (fail closed).

## To verify before implementation (blocking)

1. **URL format.** Whether `pathofexile.com/trade2/search/poe2/<league>` accepts a prefilled query
   (e.g. a `q` parameter) and in which JSON shape. Evidence: official site behaviour, recorded with
   date and example URL.
2. **Trade stat IDs.** Modifiers on the trade site use trade stat IDs, which RePoE does not carry.
   Candidate source: the trade site's public stats data file, snapshotted at build time with URL,
   date and sha256 like the RePoE snapshot (SoT §6), plus a deterministic text-template mapping
   from pack stat translations to trade entries, with a validation gate and a coverage report.
   Unmapped modifiers get no trade filter and a reason code.
3. **League.** The league name changes each season. Options: a settings field, or a build-time
   snapshot of the league list. A runtime fetch would be a second network exception (SoT §3.5).
4. **Policy.** Re-read GGG developer docs / terms for deep links to the trade site.

## Sketch (subject to the checks above)

- Domain: `tradeQuery(item, modifierIds, data) -> { ok: true, query } | { ok: false, reason }`,
  pure, IDs only; the URL is built in main.
- Filters: base type (from the pack), item class category, stat presence for the picked and existing
  modifiers (no values invented; value ranges only if the stat text of the item gives them).
- UI: "Search on trade" next to the preview and per modifier row; EN/PL labels; disabled with a
  reason when the query is incomplete.
- Architecture test: `openExternal` only with the trade base URL (and the releases page, spec 011).

## Acceptance criteria (draft)

1. Picked modifier + resolvable base → the browser opens the trade site with base and stat filled in.
2. A modifier without a trade mapping → button disabled, reason shown, no partial search pretending
   to be complete.
3. No request to the trade API from the app.

## Dependencies

002 (snapshot pipeline), 011 (openExternal boundary), 012 (item preview).
