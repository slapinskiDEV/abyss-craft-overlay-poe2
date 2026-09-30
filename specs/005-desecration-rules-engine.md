# 005 — Desecration rules engine

**SoT refs:** §0.1–0.2, §4.2, §7.2–7.10, §9.4–9.5, §10, §11, §12, §13, §14, §15, §17, §18.3, §20, §21

## Goal

A pure TypeScript engine that, for a parsed item, a Bone, active Omens and a validated data pack,
returns craft status, branch-specific pools with stage-level reasons and provenance, and an
explicit **pool completeness** for every branch. It never shows probabilities, never guesses an
undocumented interaction, and never presents a non-final pool as final.

## In scope

- `evaluateDesecration()` (ordinary mode + Putrefaction mode).
- Pre-validation with evidenced status mapping; branch generation; staged pool construction;
  floors; Lich force; group blocking (resolved and conditional); completeness; reveal/recovery
  metadata.
- Data-driven UI helpers `boneOptions()` / `omenOptions()`.

## Out of scope

- Reveal sampling / probabilities (U-004).
- Special unique systems (U-005), Time-Lost Jewels (U-006) -> `unsupported`.
- Any hardcoded catalog or constant: Bones, Omens and numbers come from the pack only.

## Interfaces / contracts

```ts
function evaluateDesecration(input: {
  item: ParsedItem;
  parserConfidence: ParserConfidence;   // additive to the SoT §4.2 call shape
  currency: string;                     // BoneDefinition.id from the pack
  activeOmens: readonly string[];       // OmenDefinition.id[] from the pack
  data: DataPack;
}): DesecrationEvaluation;

type PoolCompleteness = 'final' | 'base_eligibility_only' | 'unknown';

interface DesecrationEvaluation {             // SoT §14.6 + additive fields
  status: 'valid' | 'valid_with_warning' | 'invalid' | 'unsupported' | 'unknown';
  reasons: Diagnostic[];
  branches: DesecrationBranchResult[];
  recoveryHints: RecoveryHint[];
  parserConfidence: ParserConfidence;
  dataManifest: DataManifestSummary;          // SoT §0.2 rule 8
  mode: 'desecrate' | 'putrefaction';
  poolCompleteness: PoolCompleteness;         // weakest over branches; 'unknown' if none
  reveal: { optionCount: number; rerollsAvailable: number };   // pack constant / Omen effect
  mechanicNotes: Diagnostic[];
  putrefaction?: { maxUnrevealed: number; fracturedKept: number; corrupts: true };
}

interface DesecrationBranchResult {           // SoT §14.6 + additive fields
  id: string;                                 // deterministic: `${kind}:${side}:${affixIndex ?? '-'}`
  kind: 'mark_replacement' | 'open_slot' | 'removal' | 'putrefaction';
  side: AffixSide;
  removedAffixId?: string;
  removedAffixRawText?: string[];
  completeness: PoolCompleteness;
  completenessReasons: Diagnostic[];
  eligible: ModifierCandidate[];              // empty when completeness === 'unknown'
  conditional: ConditionalModifierCandidate[];// could be blocked by an unresolved affix
  blocked: BlockedModifierCandidate[];
  poolSummary: { regular: number; exclusive: number; amanamu: number; ulaman: number;
                 kurgal: number; otherworldly: number; jewelExclusive: number };
}

interface ModifierCandidate {
  modifierId: string; side: AffixSide; requiredLevel: number; tierFamilyId: string;
  sourceKind: ModifierSourceKind; lichPool?: LichPool; specialPools: SpecialPool[];
  sourceRefs: string[];                       // provenance (SoT §14.4 step 10)
  notes: ReasonCode[];                        // e.g. FAMILY_FLOOR_FALLBACK_TIER
}
interface BlockedModifierCandidate extends ModifierCandidate { reasons: CandidateReason[] }
interface ConditionalModifierCandidate extends ModifierCandidate { unresolvedAffixIndexes: number[] }

type ReasonCode = (typeof DIAGNOSTIC_CODES)[number];          // shared registry, below
type CandidateReasonCode = Extract<ReasonCode, 'WRONG_SIDE' | 'ITEM_LEVEL_TOO_LOW'
  | 'BELOW_MINIMUM_MODIFIER_LEVEL' | 'MOD_GROUP_CONFLICT' | 'BASE_TAG_NOT_ELIGIBLE'
  | 'SOURCE_NOT_ENABLED' | 'LICH_SOURCE_NOT_SELECTED' | 'OTHER_LICH_BLOCKED_BY_FORCE_OMEN'
  | 'PUTREFACTION_EXCLUDES_EXCLUSIVE' | 'SPECIAL_JEWEL_RULE' | 'POSSIBLY_BLOCKED_BY_UNRESOLVED_AFFIX'>;
interface CandidateReason { code: CandidateReasonCode; params?: Record<string, string | number> }
type OmenPhase = OmenDefinition['phase'];                        // 002
interface RecoveryHint { kind: 'annul_desecrated_only'; omenId: string; currencyId: string }
interface DataManifestSummary {
  dataPackId: string; schemaVersion: number; targetGameVersion: string;
  repoeObservedVersion: string; generatedAt: string; validated: boolean; stale: boolean;
}

interface Diagnostic {                        // no message field (SoT §5.8)
  code: ReasonCode;
  severity: 'error' | 'unsupported' | 'warning' | 'unknown' | 'info';   // 'unsupported' maps to status unsupported
  params?: Record<string, string | number | string[]>;
  uRef?: string;                              // e.g. 'U-012'
  evidenceRefs?: string[];                    // provenance IDs of the rule that fired
}
```

### Status mapping — `invalid` only for evidenced incompatibility

| Condition | Code | Status | Basis |
|---|---|---|---|
| item not Rare | `ITEM_NOT_RARE` | invalid | SoT §10.2, §14.1 |
| corrupted | `ITEM_CORRUPTED` | invalid | SoT §14.1 |
| `existingDesecration: 'present'` | `ITEM_ALREADY_DESECRATED` | invalid | SoT §14.1 |
| `existingDesecration: 'undetermined'` | `EXISTING_DESECRATION_UNDETERMINED` | unknown | U-014, U-011 |
| item-class target ≠ Bone target (evidenced mapping) | `BONE_INCOMPATIBLE_ITEM_CLASS` | invalid | SoT §10.2 |
| item class has no target-mapping entry | `ITEM_CLASS_TARGET_UNMAPPED` | unknown | SoT §0.2 rule 4 |
| ilvl > Bone `maxItemLevel` | `GNAWED_ITEM_LEVEL_TOO_HIGH` | invalid | SoT §10.2 |
| Lich Omen + incompatible Bone family | `LICH_OMEN_INCOMPATIBLE_WITH_BONE` | invalid | SoT §11.3 |
| Lich Omen + Altered Collarbone | `ALTERED_COLLARBONE_LICH_OMEN_CONFLICT` | invalid | SoT §10.4, §11.3 |
| Sinistral + Dextral | `CONFLICTING_SIDE_OMENS` | unsupported | SoT §14.2 calls it "not meaningful" but cites no game error; the app does not model it |
| more than one Lich Omen | `UNKNOWN_MULTIPLE_LICH_OMENS` | unknown | undocumented |
| Putrefaction + side/Lich Omen | `UNKNOWN_PUTREFACTION_OMEN_COMBINATION` | unknown | undocumented |
| Putrefaction + Mark present | `UNKNOWN_PUTREFACTION_MARK_INTERACTION` | unknown | undocumented |
| Altered Collarbone + Putrefaction | `UNKNOWN_ALTERED_PUTREFACTION_INTERACTION` | unknown | U-002 |
| special unique | `UNSUPPORTED_SPECIAL_ITEM` | unsupported | SoT §2.3, U-005 |
| Time-Lost Jewel | `SPECIAL_JEWEL_RULE` | unsupported | SoT §2.3, U-006 |
| parser `insufficient` | `PARSER_INSUFFICIENT` | unknown | SoT §14.1 (app cannot identify the base) |
| Bone/Omen rule missing or only `ASSUMPTION_BLOCKED` evidence | `RULE_EVIDENCE_MISSING` | unknown | SoT §0.3 |
| affix limit for class missing | `AFFIX_LIMIT_UNKNOWN` | unknown | SoT §0.2 rule 4 |
| unknown-side affix affects slot counting | `AFFIX_CAPACITY_UNDETERMINED` | unknown | SoT §9.4 |
| `markState: 'undetermined'` | `MARK_STATE_UNDETERMINED` | unknown | SoT §12.1 |
| removal/Putrefaction needs fractured state, `fracturedState: 'undetermined'` | `FRACTURED_STATE_UNDETERMINED` | unknown | U-011 |
| pack `manifest.validated !== true` | `DATA_CONFLICT` | unknown | SoT §0.2 rule 4 |
| Bone `releaseState: drop_disabled_legacy` | `LEGACY_CURRENCY` | info | SoT §2.2 |

Aggregation: `invalid` > `unsupported` > `unknown` > `valid_with_warning` > `valid`; all failing
checks are collected. For `invalid` / `unsupported` / `unknown`, `branches` is empty. The single
exception is the empty-forced-Lich case below, whose craft status is fixed by SoT §11.3 /
§18.3 #7–8.

### Branch generation (SoT §14.3)

- **Case A, non-fractured Mark:** no side Omen or same-side Omen -> one `mark_replacement` branch
  on `markSide` (`MARK_REPLACED_FIRST`). Opposite-side Omen -> `UNKNOWN_MARK_SIDE_INTERACTION`,
  status `unknown` (U-001). Fractured Mark -> `UNKNOWN_FRACTURED_MARK_INTERACTION`, `unknown`
  (U-007; SoT documents only the non-fractured Mark).
- **Side Omen, side s:** s open -> one `open_slot` branch. s full -> one `removal` branch per
  non-fractured affix on s. None removable -> `NO_REMOVABLE_AFFIX_ON_SIDE`, `unsupported`
  (SoT §14.3 "conservative unsupported/invalid"; no evidenced game error, U-007).
- **No side Omen:** both sides open -> two `open_slot` branches; both full -> `removal` branches for
  every non-fractured affix on both sides; exactly one side open ->
  `UNKNOWN_MIXED_CAPACITY_SIDE_CHOICE`, status `unknown`, **no branches** (U-012 — fail closed; no
  interpretation is exposed).

### Staged pool construction per branch (SoT §7.10, §14.4)

Each stage is a pure function `(candidates, ctx) -> { kept, rejected: Map<id, CandidateReason[]> }`
with its own unit tests.

1. **Effective tags** = `base.tags` ∪ `addsTags` of uniquely matched remaining affixes (SoT §7.8).
   An unresolved remaining affix whose candidates disagree on `addsTags` ->
   `CONDITIONAL_TAGS_INCOMPLETE`, completeness at most `base_eligibility_only`.
2. **regularBasePool:** `sourceKind: 'regular'`, side s, ordered spawn weight > 0 on effective
   tags; else `BASE_TAG_NOT_ELIGIBLE`.
3. **naturalDesecratedPool:** `sourceKind: 'desecrated_exclusive'`, side s, ordered spawn weight > 0
   on effective tags; Otherworldly-gated rows ignored here (SoT §7.6 rule 5).
4. **otherworldlyExtensionPool:** only when the Bone's `unlocksSpecialPools` has `otherworldly`:
   rows with `specialPools ∋ otherworldly`, side s, item jewellery class ∈
   `otherworldlyJewelleryClasses` — separate rule, not the ordinary evaluator (SoT §7.6). For other
   Bones such rows are `SOURCE_NOT_ENABLED` (listed in search only).
5. **postItemLevelPool:** `requiredLevel <= itemLevel`, else `ITEM_LEVEL_TOO_LOW`. Never waived
   (SoT §13.4).
6. **postGroupBlockPool:** groups ∩ resolved remaining groups -> `MOD_GROUP_CONFLICT` (params:
   conflicting affix index; modId when known). Groups ∩ `possibleGroups` of an unresolved remaining
   affix -> `conditional` (`POSSIBLY_BLOCKED_BY_UNRESOLVED_AFFIX`). An unresolved affix with zero
   candidates (unbounded groups) makes every candidate conditional. Any conditional candidate ->
   completeness `base_eligibility_only` + `PARSER_PARTIAL_MOD_GROUPS`.
   *Pre-check (U-008):* an Ancient Bone on a `mark_replacement` branch returns
   `UNKNOWN_ANCIENT_MARK_FLOOR`, status `unknown`, **before** stages 7–8 and regardless of any Lich
   Omen — the SoT documents neither the floor combination nor whether the Lich override settles it.
7. **Lich force** (compatible Lich Omen active): `forced` = kept, non-conditional candidates with
   `lichPool === effect.lichPool` and without `lichPoolConflict`, no floors (SoT §10.3, §13.4).
   - `forced` non-empty -> eligible = `forced`; others `LICH_SOURCE_NOT_SELECTED` or
     `OTHER_LICH_BLOCKED_BY_FORCE_OMEN`; Ancient -> warning `ANCIENT_BENEFIT_OVERRIDDEN_BY_LICH_OMEN`;
     Mark branch -> info `MARK_FLOOR_OVERRIDDEN_BY_LICH_OMEN`.
   - `forced` empty -> warning `FORCED_LICH_POOL_EMPTY` (params: omenId, limiting factor); craft
     status `valid_with_warning` (SoT §11.3). Fallback composition (U-013): if an Ancient or Mark
     floor applies, or any non-forced `desecrated_exclusive` candidate survived stages 3–6, the
     branch has `completeness: 'unknown'` (`UNKNOWN_LICH_FALLBACK_COMPOSITION`, eligible empty).
     Otherwise the branch pool is the surviving regular candidates with `completeness: 'final'`.
8. **postMinimumLevelPool** (no Lich force): floor = Bone `minimumModifierLevel` (Ancient), or
   `floor(itemLevel × markFactor)` on a `mark_replacement` branch (U-003); both at once never
   reaches this stage (U-008 pre-check). Family filter per SoT §7.10 over ilvl-eligible
   candidates, applied to eligible **and** conditional candidates (a conditional row that fails the
   floor becomes blocked); the kept fallback tier gets `FAMILY_FLOOR_FALLBACK_TIER`; dropped tiers
   get `BELOW_MINIMUM_MODIFIER_LEVEL`.
9. **Final:** eligible / conditional / blocked, `poolSummary` over eligible, provenance attached.

Reason collection: stages 2–6 are independent predicates, so every candidate is checked by all of
them and a blocked candidate lists **every** failing reason. The set-dependent floor stage runs
only on candidates that passed 2–6.

### Completeness (SoT §9.4, §18.3 #24–25)

- `final`: parser `full`, no conditional candidates, tags complete, no U-item affecting the branch.
- `base_eligibility_only`: parser `partial` with bounded uncertainty (sides and capacity known;
  groups or tags unresolved). The eligible list may only be shown under an explicit non-final
  label (006).
- `unknown`: anything else; `eligible` is empty.

### Putrefaction mode (SoT §2.2, §11.6)

- Pre-validation as in the table, including the Putrefaction-specific unknown rows.
- Requires affix limits and `fracturedState: 'determined'`.
- `maxUnrevealed = maxPrefixes + maxSuffixes − fracturedCount`; `fracturedKept = fracturedCount`.
  SoT §11.6 says "usually six / usually five": this formula is a working model from the evidenced
  affix limits, shown as "up to N" with `uRef: 'U-007'`; a Well-of-Souls record (007) confirms it.
- Branches `putrefaction:prefix` and `putrefaction:suffix`: regular-source stages 1, 2 and 5, and
  group blocking only against fractured affixes. All non-regular rows are blocked with
  `PUTREFACTION_EXCLUDES_EXCLUSIVE`.
- No floor is applied. With an Ancient Bone, add warning `ANCIENT_FLOOR_NOT_GUARANTEED_PUTREFACTION`
  (the unfloored pool is the set of possible modifiers, SoT §11.6).
- Warning `ITEM_WILL_BE_CORRUPTED`. Six-mod combinations are not enumerated.

### Reveal / recovery

- `reveal.optionCount` comes from an evidenced pack constant (SoT §11.4). A reroll Omen sets
  `rerollsAvailable` from `effect.rerolls`; the pool is unchanged (`ECHOES_REROLL_AVAILABLE`).
- `annul_desecrated_only` Omen + `abyss.hasRevealedDesecratedModifier` (revealed, not merely
  unrevealed — SoT §11.5) -> recovery hint
  `{ omenId, currencyId }`, where `currencyId` is the pack's resolved Orb of Annulment entry (002).
- `EXCLUSIVE_OPTION_GUARANTEE_NOTE` (SoT §17.2) is added when a final pool has ≥ 1 exclusive and
  no Lich force is active.

### UI helpers (data-driven, SoT §0.2 rule 7)

```ts
function boneOptions(item: ParsedItem, data: DataPack, opts: { includeLegacy: boolean }):
  Array<{ boneId: string; selectable: boolean; reasons: Diagnostic[] }>;
function omenOptions(item: ParsedItem, boneId: string | null, activeOmens: readonly string[], data: DataPack):
  Array<{ omenId: string; phase: OmenPhase; effectKind: OmenEffect['kind']; selectable: boolean; reasons: Diagnostic[] }>;
```

Both iterate `data.bones` / `data.omens` and reuse the pre-validation predicates, so disabled
options and engine verdicts cannot diverge.

### Code registry

All codes live in one `as const` list `DIAGNOSTIC_CODES` in `src/shared/diagnostic-codes.ts`
(dependency-free, importable by domain, parser, i18n and main): SoT §15 codes, the codes above,
004 parser codes, 003 `GAME_TERM_*` and 001 `DATA_PACK_*` / `HOTKEY_*` codes, each with a default
severity, owning layer and optional `uRef`. The 003 parity test reads it.

## Algorithm/design choice

- **Adopted:** branch enumeration (SoT §14 reference), family floor function (SoT §7.10), stage
  separation (SoT §7.10 "Pool construction separation").
- **Improvement — conditional bucket (stage 6).**
  - *Context:* the SoT allows a `base_eligibility_only` view for partial parses.
  - *Decision:* split candidates into eligible / conditional / blocked using `possibleGroups` from 004.
  - *Why:* it shows exactly which modifiers an unresolved affix could block, instead of flagging
    the whole list as unreliable.
  - *Preserved:* a partial result is never final (§9.4); no guessed IDs (§9.5); every exclusion is
    explained (§0 rule 8).
  - *Trade-off:* one more list in the UI.
  - *Verification:* TEST_ONLY ambiguity cases prove that conditional ⊇ the extra blocks a full parse
    would add.
- **Improvement — all-reasons collection.** Stages 2–6 are evaluated independently, so blocked rows
  explain every cause. An equivalence property test proves the eligible set is identical to a
  sequential filter chain.
- **Clarification — stage order.** SoT §14.4 lists floors (7) before group blocking (8) and Lich (9).
  Here group blocking (6) and Lich (7) come before floors (8). Why: the forced-Lich pool must know
  group blocking but must not be floored (SoT §10.3), and floors are per-family set operations
  that should run once on the final non-Lich set. Equivalence: group blocking removes whole
  families (tiers share groups), so floor∘block = block∘floor for the eligible set; a property test
  asserts identical eligible sets for both orders on the TEST_ONLY pack.
- **Clarification — craft status vs pool completeness.** SoT §11.3 / §18.3 #7–8 require
  `valid_with_warning` for an empty forced-Lich pool. U-013 requires `unknown` for the fallback
  composition when floors or non-forced exclusive mods can matter. Both hold when the craft status
  reports the evidenced verdict and the branch reports `completeness: 'unknown'` with no pool. This
  is the only case where a non-`unknown` status carries an `unknown` pool.

## Acceptance criteria

1. SoT §18.3 cases 1–20, 24 and 25 pass on the TEST_ONLY pack. Cases 1–20 also pass on the real
   pack in the release gate (007/008).
2. `invalid` appears only for rows marked `invalid` in the status table.
3. U-001, U-002, U-008, U-012, U-013 and U-014 never produce a non-empty `eligible` list.
4. Partial parses never produce `completeness: 'final'`.
5. Every blocked or conditional candidate has at least one reason. Every eligible candidate has
   `sourceRefs`.
6. No numeric weight or percentage appears in any output.
7. Output is deterministic. The domain imports nothing from Electron, React or i18next (SoT §4.2).
8. The SoT §21 Ornate Plate facts hold on the real pack.

## Tests (`tests/domain/`)

- TEST_ONLY pack (`tests/fixtures/data/test-only-pack.ts`): every ID and name starts with
  `TEST_ONLY_` and is named by **role**, never by a real name (e.g. `TEST_ONLY_BONE_ARMOUR_PLAIN`,
  `TEST_ONLY_BASE_BODY_ARMOUR_A`, `TEST_ONLY_OMEN_FORCE_LICH_A`); no real IDs are used or mirrored
  (SoT §18.1, §18.3 #26). SoT §18.3 case titles keep their real wording; the test maps each to
  role entities.
- `sot-18-3.test.ts`: one `it('SoT 18.3 #n …')` per case 1–20, 24 and 25.
- Unit tests: one per stage (1–9), one per status-table row, and branch generation for Case A,
  side Omen (open / full / no removable affix) and no side Omen (both open / both full / mixed ->
  unknown).
- Floor tests: normal filtering, fallback tier, Ancient + Mark -> unknown.
- Lich tests: non-empty forced pool; empty forced pool with and without a floor or non-forced
  exclusive mods.
- Property tests: eligible, conditional and blocked are pairwise disjoint; all-reasons collection
  and a sequential chain give identical eligible sets; removing an Omen never adds an `invalid`
  reason.
- Real-pack suite (mandatory for release): cases 1–20, using the real entities named in the SoT and
  resolved through the pack.

## Dependencies

002 (pack, rule registry, constants), 004 (`ParsedItem`, candidate sets, tri-state fields).

## Unresolved items

U-001, U-002, U-003, U-004, U-005, U-006, U-007, U-008, U-011, U-012, U-013 and U-014 are each
mapped in the status table or the stage description above. None of them adds a mechanic.
