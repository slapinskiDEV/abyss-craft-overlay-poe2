# 002 — Data ingestion and normalization

**SoT refs:** §0.2 (anti-hallucination), §0.3 (provenance), §6 (sources, manifest, update), §7 (normalized model, classification, gates, reference algorithms), §10, §11, §12, §13.3, §21, U-003, U-005, U-006, U-009

## Goal

Build a single normalized, provenance-carrying, validated offline data pack from an archived RePoE
PoE2 snapshot plus an evidenced rule registry. The pack is the only source of game facts for the
parser (004), engine (005) and UI (006). Anything that cannot be sourced fails the build.

## In scope

- Snapshot fetch + archive + hashing (`scripts/update-repoe.ts`).
- Adapters RePoE -> normalized records (`src/data/adapters/`), with `sourceRefs`.
- Rule registry (`data-source/rules/`) for Bones, Omens, target groups, affix limits, mechanics
  constants, Lich overrides, special items — each entry with `RuleEvidence`.
- Classification: `sourceKind`, `lichPool`, `specialPools`, `tierFamilyId`.
- Validation gates (SoT §7.9), audit report, semantic diff, manifest.
- EN name index + EN stat translations for 003/004.

## Out of scope

- Runtime fetching; `RemoteDataPackProvider` (SoT §6.1, §6.7).
- Probabilities/weights in any consumer-facing field (SoT §17).
- Non-EN game terms (SoT §5.2).
- Time-Lost Jewel outcome modelling (U-006).

## Interfaces / contracts

### Layout

```text
data-source/
  snapshots/<retrievedAt>-<repoeVersion>/   # raw RePoE JSON, never edited; committed to git
                                            # (Git LFS if > 50 MB) so the release gate can run offline
    snapshot.json                           # per file: url, retrievedAt, sha256; version.txt content
  rules/
    evidence-wiki.json         # ProvenanceRecord[]: revision-pinned wiki quotes (npm run data:evidence)
    evidence-sot.json          # ProvenanceRecord[]: facts only the SoT states
    bones.json                 # Bone mechanics (RuleEvidence per entry)
    other-currencies.json      # non-Bone currencies referenced by mechanics (Orb of Annulment, SoT §11.5)
    omens.json                 # Omen mechanics
    item-class-targets.json    # item class -> BoneTargetGroup; unlisted classes are unmapped (unknown)
    affix-limits.json          # max prefixes/suffixes per class/rarity; needs an evidence.json
                               # entry (not in SoT §25 yet); missing -> 005 AFFIX_LIMIT_UNKNOWN
    mechanics-constants.json   # Ancient floor, Gnawed ilvl cap, Mark factor (U-003) …
    lich-overrides.json        # curated anomaly overrides (SoT §7.5)
    special-items.json         # U-005 / U-006 recognition
    abyss-mark.json            # Mark of the Abyssal Lord mod IDs (discovered, evidenced)
    source-classification.json # U-009 observed facts + mapping
  game-localization/en/        # generated EN term table (003)
  manifest/target.json         # targetGameVersion, stale flag (SoT §22.2)
src/data/
  adapters/                    # pure TS, used by scripts + tests
  normalized/                  # types, loader; generated pack in normalized/pack/
  manifest/                    # manifest types; generated manifest.json
```

### Provenance (SoT §0.3)

`ProvenanceRecord` and `RuleEvidence` exactly as SoT §0.3. Additionally:

- Every snapshot file gets a `ProvenanceRecord` (`sourceName: 'RePoE PoE2'`, `sourceUrl`,
  `observedVersion` from `version.txt`, `retrievedAt`, `sha256`, `evidenceLevel: VERIFIED_PRIMARY`).
- Every generated base/mod record has `sourceRefs: [snapshotFileRecordId + '#' + rawKey]`.
- Every rule entry has `evidence: RuleEvidence` whose `evidenceRefs` point to `evidence.json`
  records (wiki/poe2db URLs, manual Well-of-Souls records from 007).
- `ASSUMPTION_BLOCKED` evidence may be stored (to document an open item) but is never consumed as
  a positive rule; the engine treats such a rule as absent -> `unknown`.
- The pack exposes `provenance: Record<string, ProvenanceRecord>` so debug output can cite IDs
  offline.

### Normalized types

`BaseItemDefinition`, `ModifierDefinition`, `ModifierSourceKind`, `LichPool`, `SpecialPool` exactly
as SoT §7.1–7.2. Additional types:

```ts
type BoneFamily = 'jawbone' | 'rib' | 'collarbone' | 'altered_collarbone' | 'cranium' | 'vertebrae';

interface BoneDefinition {
  id: string;                        // app-stable key (SoT §5.5), e.g. 'preserved_rib'
  gameMetadataId: string;            // resolved from snapshot base_items (see "Entity resolution")
  canonicalNameEn: string;           // copied from snapshot record
  family: BoneFamily;
  targetGroup: BoneTargetGroup;      // SoT §10.1
  maxItemLevel?: number;             // Gnawed (SoT §10.2)
  minimumModifierLevel?: number;     // Ancient (SoT §10.3)
  unlocksSpecialPools: SpecialPool[];// Altered Collarbone: ['otherworldly'] (SoT §10.4)
  releaseState: 'current' | 'drop_disabled_legacy';
  evidence: RuleEvidence;
  sourceRefs: string[];
}

type OmenEffect =
  | { kind: 'force_side'; side: AffixSide }
  | { kind: 'force_lich'; lichPool: LichPool }
  | { kind: 'putrefaction' }
  | { kind: 'reveal_reroll'; rerolls: number }
  | { kind: 'annul_desecrated_only' };

interface OmenDefinition {
  id: string;                        // app-stable key
  gameMetadataId: string;
  canonicalNameEn: string;           // copied from snapshot record
  phase: 'desecrate' | 'reveal' | 'annul';
  effect: OmenEffect;
  compatibleBoneFamilies: BoneFamily[] | 'any';
  evidence: RuleEvidence;
  sourceRefs: string[];
}

interface ItemClassTarget { itemClassId: string; target: BoneTargetGroup | 'none'; evidence: RuleEvidence }
interface AffixLimit { itemClassId: string; rarity: 'rare'; maxPrefixes: number; maxSuffixes: number; evidence: RuleEvidence }
interface LichOverride { modifierId: string; lichPool: LichPool; mechanic: string; reason: string; evidence: RuleEvidence }
interface SpecialItemRule {
  match: { baseItemId?: string; uniqueRecordId?: string; itemClassId?: string };
  handling: 'unsupported_special_item' | 'special_jewel_rule';
  evidence: RuleEvidence;
}

interface DataPack {
  manifest: DataManifest;                         // SoT §6.5 + extensions below
  provenance: Record<string, ProvenanceRecord>;
  itemClasses: Array<{ id: string; canonicalNameEn: string; sourceRefs: string[] }>;
  baseItems: BaseItemDefinition[];
  modifiers: ModifierDefinition[];                // + addsTags, otherworldlyJewelleryClasses
  statTranslationsEn: StatTranslationTable;
  nameIndexEn: EntityNameIndex;                   // used by 004 (canonical EN name -> IDs)
  bones: BoneDefinition[];
  omens: OmenDefinition[];
  otherCurrencies: Array<{ id: string; gameMetadataId: string; canonicalNameEn: string; role: 'recovery'; evidence: RuleEvidence; sourceRefs: string[] }>;  // e.g. Orb of Annulment (SoT §11.5)
  itemClassTargets: ItemClassTarget[];
  affixLimits: AffixLimit[];
  mechanicsConstants: Record<string, { value: number; evidence: RuleEvidence; uRef?: string }>;
  abyssMarkModifierIds: string[];
  specialItems: SpecialItemRule[];
}
```

`ModifierDefinition` carries three adapter fields beyond the SoT reference shape (allowed as
clarification): `addsTags: string[]` (SoT §7.3, §7.8),
`otherworldlyJewelleryClasses: Array<'amulet'|'ring'|'belt'>` (SoT §7.6) and
`lichPoolConflict: boolean` (SoT §7.5 rule 4 — excluded from forced-Lich pools until reviewed).

```ts
interface StatTranslationTable {        // from RePoE stat_translations (EN)
  entries: Array<{
    statIds: string[];                  // stable stat IDs, in RePoE order
    variants: Array<{ template: string; conditions: unknown[]; formats: string[] }>;
    sourceRefs: string[];
  }>;
}

interface EntityNameIndex {             // generated; one per game-term locale (MVP: EN)
  baseItemsByName: Record<string, string[]>;    // canonical name -> base IDs
  itemClassesByName: Record<string, string[]>;
  modifiersByName: Record<string, string[]>;    // advanced-copy mod name -> mod IDs
}
```

Name-index values are arrays: a name mapping to several IDs is kept ambiguous, never collapsed.

`mechanicsConstants` holds at least `ancientMinimumModifierLevel`, `gnawedMaxItemLevel`,
`markFloorFactor` (uRef U-003) and `revealOptionCount` (SoT §11.4), each evidenced.

Numbers such as 40, 64, 0.40 and 3 exist only in `bones.json` / `mechanics-constants.json`, each
with evidence (SoT §10.2, §10.3, §12.2). No engine or UI code hardcodes them.

### Entity resolution (no guessed IDs — SoT §0.2 rules 2–3)

Bones, Omens and other referenced currencies are located in the snapshot, never typed:

0. Assumption checked at build time: currencies and Omens are records in `base_items.json`.
   If they are not found there, resolution fails with `ENTITY_UNRESOLVED` — the build stops
   rather than searching heuristically elsewhere.
1. The rule entry names the entity by the exact canonical EN name given in SoT §10.2 / §11.1
   / §11.5 (the SoT is the evidence for *which* entities are in scope) — field `lookupNameEn`.
2. The adapter searches snapshot `base_items.json` for records with exactly that `name`.
3. Exactly one match -> `gameMetadataId` and `canonicalNameEn` are taken from that record, and
   `sourceRefs` points to it. Zero or multiple matches -> `ENTITY_UNRESOLVED` / `ENTITY_AMBIGUOUS`,
   build fails.
4. Resolved IDs are written to the generated pack (and to the audit report), so later snapshots
   diff by ID, not by name.
5. App-stable keys (SoT §5.5 `preserved_rib`, §5.8 `omen_of_the_liege`) are **derived**, not
   hand-written: `id = lowercase(lookupNameEn)` with every run of non-alphanumeric characters
   replaced by `_` and trimmed. Collisions fail the build. The key is an internal handle; the game
   identity is always `gameMetadataId`.

Same principle for the Lich anomaly override (SoT §7.5, "Gain (3-6) Rage on Melee Hit" suffix):
the override entry stores the *description* from SoT plus evidence; the adapter resolves it to
exactly one modifier ID via stat text/ID match in the snapshot; the resolved ID is written to the
audit report for maintainer review. Unresolvable or ambiguous -> the row stays excluded from every
forced-Lich pool and the build reports `LICH_OVERRIDE_UNRESOLVED` (review required).

Mark of the Abyssal Lord IDs (`abyss-mark.json`) and special items follow the same pattern
(discovery by SoT-given names + context, resolved ID recorded, ambiguity fails closed).

### Mod selection and classification (SoT §6.2, §7.4–7.7)

- Input rows: every `mods.json` entry with `generation_type` prefix/suffix. `mods_by_base.json` is
  **only** a cross-check for regular affixes (SoT §6.2); a test asserts that `domain == 'desecrated'`
  rows present in `mods.json` are present in the pack.
- `sourceKind`: `domain == 'desecrated'` -> `desecrated_exclusive`; otherwise `regular` if the
  domain is an item domain listed in `source-classification.json`. Other domains are dropped with
  counts in the build report.
- U-009: before the first build, `source-classification.json` is filled by **inspecting the
  accepted snapshot** — record the observed distinct `domain` values, the rows per domain, and the
  tags used, with a `ProvenanceRecord` pointing to the snapshot. The adapter refuses to run while
  the file is empty or contradicts the snapshot (`DATA_CLASSIFICATION_UNCONFIGURED`).
- Legacy/release-disabled rows: marked via release-state evidence, excluded from recommendation
  pools, visible only with an explicit reason.
- `lichPool` (only for `desecrated_exclusive`): curated override -> canonical EN `name` pattern
  (`Amanamu's`/`of Amanamu`, `Ulaman's`/`of Ulaman`, `Kurgal's`/`of Kurgal`) -> none. Tags
  `amanamu_mod`/`ulaman_mod`/`kurgal_mod` are compared afterwards; a contradiction not covered by
  an override goes to the audit report and the row is excluded from forced-Lich pools
  (`lichPoolConflict: true`) while still participating in natural exclusive pools.
- `specialPools`:
  - Reachability: a `desecrated_exclusive` row that no in-scope base can ordinarily roll and that
    is not Otherworldly-gated (e.g. Kulemak/Watcher unique systems, zero-weight rows) is left out
    of the pack and listed in the audit report (`excludedUnreachableDesecrated`). Regular rows are
    all kept, because the parser must identify existing mods such as the Mark (weight 0).
  - `otherworldly`: `domain == 'desecrated'` and a `breach_desecration` spawn entry with weight
    > 0; `otherworldlyJewelleryClasses` from explicit `amulet`/`ring`/`belt` spawn tags regardless
    of weight (SoT §7.6).
  - `jewel_lightless` / `jewel_of_the_abyss`: desecrated rows applicable to jewel base tags whose
    canonical EN name is in the `Lightless` / `of the Abyss` family (SoT §7.7, metadata for
    UI/search only; never a Lich pool).
- `tierFamilyId`: SoT §7.2 strategy — `modTypeId` when validation passes; deterministic split by
  `(side, sorted groups, sorted stat IDs)` when one type holds distinct families; mapping stored in
  the pack.

### Manifest

SoT §6.5 fields plus: `repoeObservedVersion` (from `version.txt`, SoT §6.6), `dataPackId`
(sha256 of pack JSON), `rulesEvidenceDigest`, `stale`, `validated: true` (only written when all
gates pass).

### Validation gates (SoT §7.9) — `scripts/validate-data.ts`

Fail on every SoT §7.9 bullet, plus:

- `ENTITY_UNRESOLVED` / `ENTITY_AMBIGUOUS` for any rule entity,
- any rule entry without `evidence` or with `evidenceRefs` pointing to missing records,
- any production record whose ID or name matches `/TEST_ONLY/i`, or any pack input path under
  `tests/` (SoT §0.2 rule 9),
- item class used by any rare-capable base without an `item-class-targets` entry,
- SoT §13.3 invariants false in data (no exclusive prefixes on Body Armour/Helmet/Gloves/Boots;
  none on Sceptres) -> `SOT_INVARIANT_MISMATCH`, stop and ask the maintainer (data or SoT wrong),
- SoT §21 Ornate Plate facts (metadata ID, class, tags) not found -> same.

Output: `validation-report.json`, `audit-report.json` (Lich contradictions, overrides, resolved
IDs), `semantic-diff.md` (SoT §7.9 list).

## Algorithm/design choice

- **Adopted from SoT §7.10:** ordered spawn-weight resolution (no sorting; `null`/0 = not
  spawnable), Lich classification precedence, Otherworldly index, family floor function signature.
  These live in `src/domain/modifiers/` (engine needs them) and are tested here against real data.
- **Clarification — entity resolution by SoT-named lookup:** the SoT lists which entities are in
  scope by name but gives no IDs; resolving by exact snapshot name and recording the ID is the
  only way to obtain IDs without inventing them. Preserved invariants: SoT §0.2 rules 1–3, 6.
  Trade-off: a renamed entity breaks the build (intended — fail closed). Verification: resolution
  tests + audit report.
- **Clarification — evidence registry file:** non-snapshot evidence is centralized in
  `evidence.json` and referenced by ID, rather than repeating URLs per rule. Equal traceability,
  easier review.

## Acceptance criteria

1. `npm run data:update` performs SoT §6.7 steps in order and fails on any gate.
2. Pack loads in plain Node/Vitest; every base/mod has non-empty `sourceRefs`; every rule has
   evidence; manifest has `validated: true`.
3. No PoE2 entity name or ID is written by hand into code or rules except `lookupNameEn` values
   copied from SoT tables; game IDs come from the snapshot and app-stable keys are derived by
   rule 5 of "Entity resolution".
4. Desecrated rows are not lost (mods_by_base limitation test).
5. Lich/Otherworldly/jewel classification matches SoT §7.5–7.7 including the anomaly path.
6. No TEST_ONLY entity can enter the pack.

## Tests (`tests/data/`)

- Unit (synthetic, `TEST_ONLY_` IDs only): spawn-weight order, `null` vs 0, Lich precedence and
  contradiction audit, Otherworldly zero-weight jewellery class extraction, tier-family split,
  entity resolution (0/1/many matches), TEST_ONLY gate, evidence-ref gate.
- Real-data (skipped in dev without snapshot; **mandatory** in release gate, 007/008):
  desecrated-row preservation, SoT §13.3 invariants, Ornate Plate facts, every SoT §10.2 Bone and
  §11.1 Omen resolves to exactly one snapshot record, Lich override resolves or is reported.

## Dependencies

None.

## Unresolved items

U-003 (factor as evidenced constant with `uRef`), U-005/U-006 (`special-items.json`), U-009
(resolved inside this spec by snapshot inspection; fail closed until then).
