# 019 — Bone and Omen tooltips

**SoT refs:** §5.3, §5.4 (0.2.16), §10, §11, §16.4

## Goal

Hovering a Bone or Omen chip tells the player what it does: the official in-game text, and in the
Polish UI a short unofficial summary in Polish.

## In scope

- Data pack (schema 3): `descriptionEn` on every Bone and Omen, from the snapshot record's
  `properties.description` (RePoE `base_items`), link markup kept. Build issue
  `ENTITY_DESCRIPTION_MISSING` if empty (fails validation).
- Game-term provider: `description(id)` — markup stripped, line breaks joined.
- `src/renderer/view-model/explain.ts`: summary parts from rule fields only — Bone target group,
  `maxItemLevel`, `minimumModifierLevel`, `unlocksSpecialPools`, legacy state; Omen effect kind
  (side, Lich pool with the target groups of its compatible Bone families, Putrefaction, reveal
  reroll, annul Desecrated only with the recovery currency name).
- UI: a tooltip (not the native `title`, unreliable in the non-focusable window) on hover and focus:
  official description; `Nieoficjalnie: …` when the UI locale differs from the game-term locale;
  then the reasons an option is disabled. Pool and currency names come from the provider (English).
- Templates `workspace:explain.*` in EN and PL (EN kept for key parity; not shown in the EN UI).

## Out of scope

- Official Polish item texts (none in the pack), descriptions of other entities, free per-entity
  translations.

## Algorithm/design choice

- *Summary from rules, not per-entity translations:* the text cannot contradict what the engine
  computes (e.g. Omen of the Liege names the target groups of Jawbone and ordinary Collarbone) and
  cannot introduce mechanics that are not in the pack (SoT §0.2).

## Acceptance criteria

1. Every Bone and Omen chip shows its official EN description on hover.
2. In the PL UI the tooltip adds `Nieoficjalnie: …`; names stay English; no probability wording.
3. The build fails if a Bone or Omen has no description.

## Tests

`tests/renderer/explain.test.ts`, `tests/renderer/app.test.tsx` (EN and PL tooltip),
`npm run data:validate` (description gate), translation validation.

## Dependencies

002, 003, 006.
