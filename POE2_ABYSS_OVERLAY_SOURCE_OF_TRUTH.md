# PoE2 Abyss Craft Overlay — Source of Truth

**Status:** Living master document  
**Document version:** 0.2.13  
**Target game context:** Path of Exile 2, 0.5.5 / Forbidden Rites event context  
**Verified/researched:** 2026-09-26  
**Primary implementation target:** Windows 10/11 desktop overlay  
**Audience:** Claude Code and human maintainers

---

## 0. Authority and change policy

This file is the authoritative product and architecture source for the project.

Claude Code must use this document to create smaller implementation specifications under `/specs/`. Generated specs may clarify implementation detail but **must not contradict this file**. If a generated spec conflicts with this document, this document wins.

Rules:

1. Do not invent Path of Exile 2 crafting mechanics.
2. A mechanic that is not verified must be represented as `unknown` / `needs_manual_validation`, not guessed.
3. Business rules must be data-driven where practical and must not be hidden in UI components.
4. User-facing strings must never be hardcoded in domain logic.
5. Game terminology must never be unofficially translated.
6. The application must remain independent from the PoE2 process and game files at runtime.
7. Exact craft probabilities are explicitly out of scope until trustworthy weights are available.
8. Every exclusion from a modifier pool must be explainable by a machine-readable reason code.
9. Product/domain invariants and verified game mechanics are authoritative; reference algorithms and pseudocode are not implementation mandates unless a section explicitly says otherwise.
10. Claude Code may replace a reference algorithm with a materially better design, but must document the reason, trade-offs, preserved invariants, and verification evidence before implementation.

### 0.1 Normative requirements vs reference implementations

This document intentionally separates **what must be true** from **one possible way to implement it**.

The following are **normative** and may not be changed by implementation preference:

- verified PoE2 crafting mechanics and compatibility rules,
- supported/unsupported MVP scope,
- security boundaries and the rule that the app does not interact with the PoE2 process at runtime,
- localization policy,
- canonical data semantics and provenance requirements,
- explainability requirements, including machine-readable exclusion reasons,
- handling of uncertainty as `unknown` / `needs_manual_validation` rather than guessed behavior,
- acceptance criteria and externally observable behavior.

Algorithm descriptions, data-flow sketches, pseudocode, suggested data structures, ordering strategies, indexes, caching approaches, and internal decomposition are **reference designs by default**. They capture the current best understanding and important edge cases, but Claude Code is allowed to propose a different implementation when it is demonstrably better.

A deviation from a reference design is acceptable only if all of the following are true:

1. It preserves every relevant normative invariant and verified mechanic.
2. It produces equivalent or more precise externally observable results for the documented test matrix.
3. It preserves or improves explainability; it must still be possible to state why a modifier is eligible or blocked.
4. It does not hide uncertainty or convert an unknown interaction into an assumed rule.
5. It does not weaken data provenance, determinism, testability, localization boundaries, or security boundaries.
6. It has a clear engineering benefit such as simpler reasoning, lower complexity, better performance, easier maintenance, safer updates, or better extensibility.
7. The benefit and trade-offs are written down before implementation.
8. Tests are added or updated to demonstrate behavioral equivalence for affected rules and edge cases.

For any meaningful deviation, Claude Code should add a short Architecture Decision Record under `/docs/adr/` or an equivalent decision section in the relevant spec containing:

- `Context` — what reference design is being reconsidered,
- `Decision` — the alternative approach,
- `Why` — why it is better for this project,
- `Preserved invariants` — which Source-of-Truth requirements remain unchanged,
- `Trade-offs` — disadvantages or new complexity,
- `Verification` — tests/fixtures proving correctness.

Claude Code must **not** deviate merely to be different, and must not silently rewrite domain semantics. If there is no clear advantage, prefer the reference design.

### Evidence levels

Use these confidence labels in rules/data documentation:

- `VERIFIED_PRIMARY`: official GGG source or directly encoded game-derived data.
- `VERIFIED_SECONDARY`: current PoE2 Wiki / PoE2DB mechanics with consistent evidence.
- `MANUAL_CONFIRMED`: reproduced in the live game by a maintainer.
- `ASSUMPTION_BLOCKED`: not sufficiently verified; implementation must not pretend certainty.

### 0.2 Data truth and anti-hallucination policy

**Zero invented game data is a normative requirement.** Claude Code, an LLM, a contributor, or a convenience script must never be treated as a source of Path of Exile 2 facts. An LLM may design code that consumes verified data; it may not manufacture the game data that code consumes.

This applies to every game-domain fact, including but not limited to:

- base items and base-item IDs,
- item classes and tags,
- currencies/Bones,
- Omens,
- modifier IDs, names, stat ranges, tiers, groups and required levels,
- spawn/generation weights and tags,
- Lich/Otherworldly/special-pool membership,
- release/legacy state,
- crafting compatibility and mechanic rules.

Required behavior:

1. **Every production game-data record must be source-backed.** It must be traceable to an accepted snapshot or to an explicitly documented rule-evidence entry.
2. **No memory-filled catalogs.** Claude Code must not create a list of items, currencies, Omens or modifiers from model memory, examples in conversation, intuition, naming patterns, or guessed game knowledge.
3. **No guessed IDs or names.** If a canonical ID/name cannot be resolved from accepted data, the entity is unresolved. Do not synthesize a plausible ID or silently normalize it to a different entity.
4. **Fail closed.** Missing, contradictory, stale, or unresolvable data must produce `unknown`, `unsupported`, `data_conflict`, or `needs_manual_validation`. It must never produce a confident eligible-pool result based on a guess.
5. **Source disagreement is visible.** Conflicting sources are quarantined/audited and resolved by the documented precedence/evidence policy; they are never silently merged into a convenient answer.
6. **Manual exceptions require evidence.** Any curated override must identify the exact affected canonical ID(s), the mechanic being overridden, evidence reference(s), confidence level, and a short reason. An override without evidence is invalid.
7. **Runtime catalogs are generated, not improvised.** Selectors for Bones, Omens, item classes and modifier categories must be populated from the versioned data pack/rule registry. Production UI must not contain an independent hand-written fallback catalog.
8. **Data version is part of every result.** A pool result is a claim about a specific data pack/game context, not an timeless statement. The UI/logs must be able to identify the data-pack manifest used for the calculation.
9. **Synthetic data is test-only.** Unit tests may use artificial entities only when clearly namespaced/marked `TEST_ONLY` or stored under test fixtures. Synthetic entities must never be bundled into or reachable from the production game-data pack.
10. **Unknown is a valid product result.** It is better for the overlay to say it cannot verify a craft than to show a plausible but invented pool.

### 0.3 Provenance contract

The normalized data layer must preserve enough provenance to answer: **where did this fact come from?** Exact storage shape is an implementation choice, but equivalent information is required.

Reference shape:

```ts
type EvidenceLevel =
  | 'VERIFIED_PRIMARY'
  | 'VERIFIED_SECONDARY'
  | 'MANUAL_CONFIRMED'
  | 'ASSUMPTION_BLOCKED';

interface ProvenanceRecord {
  id: string;
  sourceName: string;
  sourceUrl?: string;
  observedVersion?: string;
  retrievedAt?: string;
  sha256?: string;
  sourceRecordId?: string;
  evidenceLevel: EvidenceLevel;
  notes?: string;
}

interface RuleEvidence {
  ruleId: string;
  evidenceRefs: string[];
  evidenceLevel: EvidenceLevel;
  notes?: string;
}
```

At minimum:

- generated base/mod records reference the source snapshot(s) that created them,
- manually curated currency/Omen/mechanic rules reference evidence entries,
- curated anomaly overrides reference both the canonical affected ID and their evidence,
- `ASSUMPTION_BLOCKED` evidence must never be consumed as if it were a verified positive rule,
- logs/debug output can expose provenance IDs for a pool result without requiring network access.

A different provenance schema is allowed if it provides equal or stronger traceability.

---

# 1. Product definition

## 1.1 Working name

**PoE2 Abyss Craft Overlay**

The name is provisional. Do not bake branding assumptions into core packages or domain models.

## 1.2 Core user problem

A player wants to know which modifiers are eligible when using Abyss Desecration crafting on a specific copied Path of Exile 2 item.

The application receives a copied item description, normalizes the item, lets the user select a compatible Abyssal Bone and Omens, and shows the **eligible modifier pool** plus excluded modifiers and the reasons they are excluded.

It does **not** predict the exact three reveal choices and does **not** claim exact probabilities.

## 1.3 Core workflow

1. Player hovers an item in PoE2.
2. Player presses the application hotkey. With auto-copy (default, §3.1) the overlay sends the
   advanced copy shortcut `Ctrl+Alt+C` to the game once; with auto-copy off the player copies
   manually (`Ctrl+C` or preferably `Ctrl+Alt+C`) before pressing the hotkey.
3. The overlay opens.
4. Overlay reads the current Windows clipboard.
5. Parser validates supported clipboard locale (EN in MVP) and normalizes the item to language-independent IDs.
6. App identifies base, class, item level, rarity, current affixes and relevant item states.
7. User selects an Abyssal Bone from only the compatible/meaningful options.
8. User may activate one or more compatible Abyss crafting Omens.
9. Rules engine evaluates legality and possible branches.
10. App shows:
    - craft validity,
    - warnings,
    - resulting prefix/suffix branch(es),
    - eligible modifier pool,
    - excluded modifier pool with reason codes,
    - pool source categories,
    - data version.

The **base Desecration pool** (§14.7) is shown whenever the selected Bone and Omens are compatible with
the base, even when the exact item state (existing Desecration, Mark, fractured markers, capacity)
cannot be determined from the clipboard. The item-specific result stays a separate, fail-closed
"exact item check".

## 1.4 Primary output wording

Use language equivalent to:

> Eligible modifier pool

Never present the result as:

> These are the modifiers you will get.

The reveal remains random and can include regular and exclusive Desecrated modifiers according to game rules.

The base Desecration pool (§14.7) must be labelled as the pool for the base (for example
"Possible modifiers for this base") with a visible note that current modifiers are not considered.
It must never use the "Eligible modifier pool" wording, which is reserved for a final blocker-aware
item-specific pool.

---

# 2. MVP scope

## 2.1 Included

- Windows desktop application.
- Electron + React + TypeScript.
- Always-on-top overlay window.
- Manual clipboard-based item import.
- English clipboard parsing in MVP.
- UI languages in MVP: English and Polish.
- Official EN game terms for both EN and PL UI.
- Localization/parser architecture must be registry-based so German and other languages can be added later without changing domain/rules-engine code.
- No unofficial Polish translations of PoE2 entity names.
- Rare equipment supported by normal Abyssal Bones.
- Weapons and quivers.
- Armour, including shields/foci where classified by the data as armour-compatible for Rib use.
- Amulets, rings, belts.
- Regular jewels.
- Waystone data path retained for legacy/drop-disabled Preserved Vertebrae, but hidden by default from normal recommendations.
- Gnawed, Preserved, Ancient bones.
- Altered Collarbone.
- Abyss crafting Omens.
- Essence of the Abyss / Mark of the Abyssal Lord state detection.
- Existing Desecrated modifier state detection where clipboard text allows it.
- Modifier pool filtering by base tags, side, item level, modifier group, Bone rules and Omen rules.
- Search/filter in eligible and blocked mods.
- Full reason/explainability output.
- Offline runtime with bundled versioned data pack.

## 2.2 Included with special handling

### Omen of Putrefaction

Supported as a separate craft mode, not as an ordinary one-slot Desecration.

The MVP should display:

- that existing modifiers are replaced,
- maximum number of Unrevealed modifiers possible for the base,
- corruption consequence,
- regular (non-exclusive) eligible prefix/suffix reveal pools,
- fractured-slot reduction when known,
- warnings for Ancient-bone interaction.

The MVP must not attempt to enumerate every final six-mod combination.

### Preserved Vertebrae

Data may remain supported but UI should mark it `drop-disabled/legacy` based on the current PoE2 Wiki evidence and hide it from default currency choices unless an advanced/legacy toggle is enabled.

## 2.3 Not in MVP

- Exact probability percentages.
- Price checking.
- Trade API searches.
- Automatic crafting recommendations based on market prices.
- Reading PoE2 process memory.
- Reading or modifying installed PoE2 game files at runtime.
- OCR/screen scraping.
- Automated mouse/keyboard input into PoE2.
- Automatic execution of a craft.
- Automatic activation of Omens.
- Login/OAuth.
- Cloud sync.
- Unique-item custom Desecration systems such as the full behavior of Undying Hate, Grip of Kulemak, The Unborn Lich, etc. Parser may recognize them, but the normal craft engine must return `UNSUPPORTED_SPECIAL_ITEM` until a dedicated spec is added.
- Full Time-Lost Jewel special-case simulation in the first implementation unless the data model makes it trivial; it must never be silently treated as an ordinary jewel.

## 2.4 Planned after MVP (maintainer decision, 0.2.10)

- **Trade search link** (spec 013, planned): open the official trade site in the browser with a
  search prefilled for the copied base and a picked modifier. Not implemented. Before
  implementation this section must be turned into rules: URL format and trade stat IDs evidenced,
  league source decided, policy re-checked. No trade API calls from the app, no prices.
- **No in-game search integration:** PoE2 has no in-game search that accepts pasted item text.

---

# 3. Runtime safety and GGG policy boundary

## 3.1 Required runtime boundary

The runtime data flow is:

`PoE2 -> Windows clipboard -> overlay`

Never:

`overlay -> PoE2 input/process/memory/files`

The application must:

- read only the system clipboard on explicit user invocation,
- not attach to the PoE2 process,
- not inspect process memory,
- not modify game files,
- not emulate crafting clicks,
- not send chat commands,
- send no input to the game except the single exception below.

**Auto-copy exception (maintainer decision, 0.2.6).** When the player presses the application
hotkey and the setting `autoCopy` is on (default), the overlay sends the advanced copy shortcut
`Ctrl+Alt+C` to the foreground window exactly once per press. It first releases the held hotkey
modifier, then waits a bounded time (≤ 600 ms) for the clipboard to change. It sends nothing else:
no clicks, no crafting or Omen actions, no chat, no repeated or timed input. The shortcut is not
sent while the overlay itself has focus: when the hotkey is pressed while the overlay has focus,
the overlay first hides so that Windows returns focus to the game, then sends the shortcut (0.2.9). The input-sending code lives in one module that tests
guard. The maintainer accepts the policy risk of this exception; turning `autoCopy` off restores
the fully manual flow.

## 3.2 Supported display modes

Official support target:

- Windowed: yes.
- Windowed Fullscreen: yes.
- Exclusive Fullscreen: unsupported/not guaranteed.

## 3.3 Public release notice

Any public/widely available build must visibly include:

> This product isn't affiliated with or endorsed by Grinding Gear Games in any way.

## 3.4 Relevant official policy source

GGG Developer Docs / third-party requirements:

- https://www.pathofexile.com/developer/docs

The official docs state that independent executables are permitted while applications interacting with the game or game files are against the Terms of Use.


## 3.5 App update check (maintainer decision, 0.2.8)

The packaged Windows build may check the public releases repository
`github.com/slapinskiDEV/abyss-craft-overlay-poe2-releases` for a newer app version: shortly after
start and then every few hours, only while the setting `checkForUpdates` is on (default). The check
is a plain request for the release metadata; nothing about the player, the items or the game is sent.
A newer version is offered as an "Update" button; the installer is downloaded and run only after the
player clicks it. The portable build opens the download page instead. The data pack still ships
inside the app and is never updated separately at runtime (§6.1). The network code lives in one
module that tests guard. No other network access exists at runtime.

---

# 4. Technology and repository architecture

## 4.1 Chosen stack

- Electron
- React
- TypeScript with `strict: true`
- Vite/electron-vite style build pipeline
- Vitest
- React Testing Library
- Electron Builder for Windows packaging
- i18next
- react-i18next
- a small typed settings store (electron-store is acceptable)

Avoid adding a state-management framework unless complexity demonstrably requires it. Prefer local React state plus a small application store/context.

## 4.2 Architectural rule

`domain/` must have no Electron, React or i18next dependency.

The core calculation must be executable in a plain TypeScript test:

```ts
const result = evaluateDesecration({
  item,
  currency,
  activeOmens,
  data,
});
```

## 4.3 Target repository structure

```text
poe2-abyss-overlay/
├─ src/
│  ├─ main/
│  │  ├─ main.ts
│  │  ├─ overlay-window.ts
│  │  ├─ shortcuts.ts
│  │  ├─ clipboard.ts
│  │  └─ settings.ts
│  ├─ preload/
│  │  ├─ index.ts
│  │  └─ api-types.ts
│  ├─ renderer/
│  │  ├─ App.tsx
│  │  ├─ components/
│  │  ├─ features/
│  │  └─ styles/
│  ├─ domain/
│  │  ├─ item/
│  │  ├─ modifiers/
│  │  ├─ desecration/
│  │  ├─ rules/
│  │  └─ diagnostics/
│  ├─ data/
│  │  ├─ adapters/
│  │  ├─ normalized/
│  │  └─ manifest/
│  ├─ parser/
│  │  ├─ registry/
│  │  ├─ common/
│  │  └─ en/
│  ├─ i18n/
│  │  ├─ ui/
│  │  │  ├─ en/
│  │  │  └─ pl/
│  │  └─ game/
│  │     ├─ providers/
│  │     └─ en/
│  └─ shared/
├─ data-source/
│  ├─ rules/
│  ├─ game-localization/
│  └─ manifest/
├─ scripts/
│  ├─ update-repoe.ts
│  ├─ normalize-data.ts
│  ├─ validate-data.ts
│  └─ validate-translations.ts
├─ tests/
│  ├─ fixtures/
│  │  └─ clipboard/en/
│  ├─ parser/
│  ├─ domain/
│  ├─ data/
│  └─ integration/
├─ specs/
└─ POE2_ABYSS_OVERLAY_SOURCE_OF_TRUTH.md
```

---

# 5. Localization architecture

## 5.1 UI locales in MVP

```ts
type UiLocale = 'en' | 'pl';
```

The MVP must contain complete UI resources for both.

German is deliberately deferred until the core application and crafting engine are working. This is a product-scope decision, not an architectural limitation.

## 5.2 Game-term locale in MVP

```ts
type GameLocale = 'en';
```

Rules:

- EN UI -> official EN PoE2 terminology.
- PL UI -> official EN PoE2 terminology.
- Never create homemade Polish translations for game entities.
- UI language and game terminology remain separate concepts even though the MVP has only one game-term locale.

## 5.3 Do translate

Translate application-owned text:

- headings,
- buttons,
- filters,
- warnings,
- explanations,
- settings,
- validation errors,
- onboarding/help,
- `Prefix`, `Suffix`, `Eligible`, `Blocked`, etc.

## 5.4 Do not unofficially translate

Do not invent PL names for:

- currencies,
- Omens,
- base item names,
- modifier names/stat lines,
- unique names,
- other official PoE2 entities.

## 5.5 Game terminology and UI text are separate systems

Domain entities use stable IDs.

Example:

```ts
interface CurrencyDefinition {
  id: 'preserved_rib';
  canonicalEnglishName: 'Preserved Rib';
}
```

Renderer asks a `GameLocalizationProvider` for the display name. In the MVP that provider exposes EN only.

UI messages use `i18next` keys.

Do not use game names as localization keys.

## 5.6 Settings model

```ts
interface LocalizationSettings {
  uiLocale: 'en' | 'pl';
  gameLocale: 'en';
  clipboardLocale: 'auto' | 'en';
}
```

`auto` defaults:

- Windows PL -> UI `pl`, game terms `en`.
- otherwise -> UI `en`, game terms `en`.

Clipboard locale detection is a parser concern and must remain independent of UI locale, even though MVP supports EN clipboard only.

## 5.7 Future-locale extension contract

Adding DE or another language later must not require changes to crafting/domain logic. A new locale should require only the relevant subset of:

1. register a new UI locale,
2. add `locales/<locale>/...` translation resources,
3. optionally add an official `GameLocalizationProvider` pack for that locale,
4. optionally add a clipboard parser adapter/grammar for that locale,
5. add parity/parser fixtures.

Required architecture:

```ts
interface UiLocaleDefinition {
  id: string;
  label: string;
  resources: unknown;
}

interface ClipboardParserAdapter {
  locale: string;
  detect(raw: string): number;
  parse(raw: string): ParsedItemResult;
}
```

No `if (language === 'pl') ... else ...` branching is allowed in business/domain code.

## 5.8 Translation invariants

CI/test must fail when:

- PL UI is missing a key present in EN.
- extra orphan keys diverge without explicit allowlist.
- a domain error returns a literal user-facing string.
- game entity names are found hardcoded inside PL UI resources as homemade translations.

Domain result example:

```ts
{
  status: 'invalid',
  reasons: [
    {
      code: 'LICH_OMEN_INCOMPATIBLE_WITH_BONE',
      params: {
        omenId: 'omen_of_the_liege',
        currencyId: 'preserved_rib'
      }
    }
  ]
}
```

The renderer localizes the diagnostic code.

## 5.9 Deferred German support

German is officially supported by PoE2, but is intentionally out of MVP.

When DE is added later:

- UI translations may be maintained by this project,
- game terms must come from official/game-derived German localization data,
- DE clipboard parsing must have real-game fixtures,
- missing official DE game terms must fall back to EN, never machine translation.

### 5.10 Locale extension axes are independent

UI localization, official game-term localization, and clipboard-parser localization are separate extension axes. Adding one must not require adding the other two. For example, a future UI-only locale may be added without a game-term pack or clipboard parser and can continue to display official EN game terms. Likewise, a parser locale may be added independently when verified fixtures and a canonical name index exist.

No domain/rules-engine code may depend on a concrete locale list.

---

# 6. Data sources and source precedence

## 6.1 Runtime is offline

The application ships with a normalized, versioned local data pack.

MVP does not fetch PoE2DB/Wiki/RePoE at runtime. The app update check (§3.5) is the only network
access; a new data pack arrives only as part of a new app version.

## 6.2 Primary structured data source

Use current PoE2 RePoE export as the primary structured source for base items, mods and tags.

Relevant current export index:

- https://repoe-fork.github.io/poe2/

Expected useful files include:

- `base_items.json`
- `mods.json`
- `mods_by_base.json`
- `item_classes.json`
- `tags.json`
- `tag_details.json`
- `stat_translations/*`

### Important `mods_by_base` limitation

Do not use `mods_by_base.json` as the sole source for the Abyss reveal pool. RePoE's current `mods_by_base` generator groups mods from the base item's normal domain (plus `delve`) and does not build the special `desecrated` domain into each ordinary base pool.

Therefore:

- `mods_by_base` may be used as a convenience/cross-check for ordinary regular affixes,
- raw `mods.json` + `base_items.json` + this project's special-context rules are authoritative for Desecration-exclusive, Lich, jewel-exclusive and Otherworldly pool construction,
- the data adapter must have tests proving exclusive `domain == 'desecrated'` rows are not lost.

RePoE documents `mods.json` fields including:

- `domain`
- `generation_type`
- `generation_weights`
- `groups`
- `required_level`
- `spawn_weights`
- `stats`
- `implicit_tags`

Schema source:

- https://repoe-fork.github.io/data-formats/mods.html
- https://repoe-fork.github.io/data-formats/base_items.html

## 6.3 Mechanics sources

Source priority for mechanics:

1. Official GGG patch notes/forum/docs if directly applicable.
2. Current PoE2 Wiki mechanics pages.
3. Current PoE2DB as a data/mechanics cross-check.
4. Manual in-game validation.
5. Community posts only as hypotheses, never as final authority without validation.

Core references:

- https://www.poe2wiki.net/wiki/Desecrated_modifier
- https://www.poe2wiki.net/wiki/List_of_desecrated_modifiers
- https://www.poe2wiki.net/wiki/Preserved_bone
- https://www.poe2wiki.net/wiki/Omen
- https://www.poe2wiki.net/wiki/Essence_of_the_Abyss
- https://poe2db.tw/Desecrated_Modifiers

## 6.4 Game-term localization provider

Game terminology must be behind a replaceable provider even though MVP ships EN only.

Requirements:

- `en` is canonical and the only bundled game-term locale in MVP.
- Do not machine-translate game entity names.
- Do not scrape PoE2DB at application runtime.
- A future build-time/versioned localization pack may add official/game-derived locales such as DE.
- Parser adapters for future locales are independent modules, not branches in domain code.
- Exiled Exchange 2 may be consulted as an implementation reference for localized item parsing, but this project owns its normalized data contract.

## 6.5 Data manifest

Every generated data pack must include:

```ts
interface DataManifest {
  schemaVersion: number;
  targetGameVersion: string;
  generatedAt: string;
  sources: Array<{
    name: string;
    url: string;
    observedVersion?: string;
    sha256?: string;
  }>;
  localizationLocales: string[];
}
```

Display target game/data version in Settings/About.

## 6.6 Observed upstream data version

At research time (2026-09-26), `https://raw.githubusercontent.com/repoe-fork/poe2/master/version.txt` returned:

```text
4.5.5.2
```

The update script must record the observed RePoE version/string in the generated manifest. Do not hardcode this value as permanent; it is a freshness stamp only.

## 6.7 Update workflow

Developer workflow:

```text
npm run data:update
  -> fetch source snapshots
  -> hash/archive source snapshots
  -> normalize
  -> attach provenance/evidence references
  -> validate schemas + anti-hallucination gates
  -> generate manifest
  -> run domain fixtures
  -> show semantic diff + unresolved conflicts
```

MVP runtime must not auto-update data.

Architecture should permit a future `RemoteDataPackProvider`, but do not implement it unless separately specified.

---

# 7. Normalized data model

## 7.1 Normalized base item

```ts
interface BaseItemDefinition {
  id: string;                 // stable metadata ID
  canonicalNameEn: string;
  itemClassId: string;
  tags: string[];
  domain: string;
  releaseState: 'released' | 'legacy' | 'unreleased' | 'unique_only' | string;
  sourceRefs: string[];        // provenance IDs; must not be empty in production data
}
```

## 7.2 Normalized modifier

```ts
type AffixSide = 'prefix' | 'suffix';

type ModifierSourceKind =
  | 'regular'
  | 'desecrated_exclusive';

type LichPool = 'amanamu' | 'ulaman' | 'kurgal';

type SpecialPool =
  | 'otherworldly'
  | 'jewel_lightless'
  | 'jewel_of_the_abyss';

interface ModifierDefinition {
  id: string;
  canonicalNameEn: string;
  side: AffixSide;
  domain: string;
  modTypeId: string;
  requiredLevel: number;
  groups: string[];
  implicitTags: string[];
  spawnWeights: Array<{ tag: string; weight: number }>;
  generationWeights: Array<{ tag: string; weight: number }>;
  stats: Array<{
    id: string;
    min: number;
    max: number;
    text?: string;
  }>;
  tierFamilyId: string;
  sourceKind: ModifierSourceKind;
  lichPool?: LichPool;
  specialPools: SpecialPool[];
  sourceRefs: string[];        // provenance IDs; must not be empty in production data
}
```

`sourceKind`, `lichPool` and `specialPools` are intentionally separate. A named Amanamu modifier is still a Desecration-exclusive modifier; `lichPool` is an additional classification used by force-Omens.

### `tierFamilyId`

This is needed for Ancient/Mark minimum-modifier-level behavior.

Generation strategy:

1. Prefer RePoE `type` (`modTypeId`) as the family key when validation shows it groups the tier ladder correctly.
2. Validate that members share side and compatible stat shape/group semantics.
3. If one RePoE `type` contains multiple mechanically distinct families, split it deterministically in the adapter using stable internal data (`groups`, stat IDs, side), never localized display text.
4. Store the derived mapping in the generated data pack so runtime does not recompute heuristics.

Do not use tier number or translated display name as the family identity.

## 7.3 Core RePoE field semantics

RePoE `mods.json` fields used by this project:

- JSON key -> stable modifier ID.
- `name` -> canonical English mod name used by advanced item copy.
- `domain` -> ordinary item domain vs special `desecrated` domain.
- `generation_type` -> Prefix/Suffix.
- `type` -> stable mod-type grouping; useful for tier-family normalization.
- `groups` -> mutual-exclusion families.
- `required_level` -> modifier level/item-level eligibility input.
- `spawn_weights` -> base/context eligibility.
- `generation_weights` -> weight modifiers; retained but not converted to exact probability in MVP.
- `implicit_tags` -> crafting/category tags.
- `adds_tags` -> tags added by a mod that can affect later eligibility.
- `stats` -> stable stat IDs and ranges.

Spawn-weight entries are order-sensitive for ordinary base eligibility: the first matching base/effective tag determines the ordinary spawn weight. Weight `0` blocks ordinary spawning.

## 7.4 Regular vs Desecrated-exclusive classification

At build time:

- `domain != 'desecrated'` plus normal item-domain eligibility -> candidate source `regular`.
- `domain == 'desecrated'` and prefix/suffix -> candidate source `desecrated_exclusive`.
- legacy/release-disabled rows must be filtered or marked using release-state/source evidence and never silently recommended.

Do not classify a modifier as exclusive merely because its English name contains `Amanamu`, `Ulaman`, `Kurgal`, `Lightless`, etc. Domain is the primary exclusive/non-exclusive discriminator.

## 7.5 Lich-pool classification

Lich forcing is a semantic classification layered on top of `domain == 'desecrated'`.

The Omen mechanics are described in terms of canonical modifier names (`Amanamu's` / `of Amanamu`, etc.). Current data/wiki evidence also contains at least one known naming/tag anomaly. Therefore the data-build pipeline must use this precedence:

1. **Curated internal-ID override table** for known verified anomalies.
2. Otherwise canonical EN name pattern:
   - `Amanamu's` or `of Amanamu` -> `amanamu`,
   - `Ulaman's` or `of Ulaman` -> `ulaman`,
   - `Kurgal's` or `of Kurgal` -> `kurgal`.
3. `amanamu_mod` / `ulaman_mod` / `kurgal_mod` tags are validation evidence, not an unconditional override of a curated/name classification.
4. Any unresolved contradictory row is emitted to a build-time audit report and excluded from a forced-Lich pool until reviewed.

Known current anomaly to seed in the override/audit set:

- the `Gain (3-6) Rage on Melee Hit` suffix is documented as actually belonging to Kurgal despite conflicting Ulaman naming/data.

Never derive Lich classification from localized UI text at runtime.

## 7.6 Otherworldly/Breach classification and eligibility

Otherworldly modifiers are Desecration-domain rows gated by a positive `breach_desecration` entry. Their ordinary jewellery base-tag entries are often weight `0`; this is intentional so they do not enter ordinary Desecration pools.

Build-time index rules:

1. Candidate must have `domain == 'desecrated'`.
2. Candidate must contain `breach_desecration` with positive special-context weight.
3. `specialPools` includes `otherworldly`.
4. Applicable jewellery base categories are derived from the modifier's explicit jewellery spawn-weight tags (`amulet`, `ring`, `belt`) even when those ordinary weights are `0`.
5. Ordinary Collarbone evaluation must ignore these rows.
6. Altered Collarbone explicitly unlocks this indexed Otherworldly set for the applicable jewellery category.

Do **not** run Otherworldly through the ordinary "first matching base tag" evaluator and expect it to unlock itself; the special crafting context is a separate rule.

## 7.7 Jewel-exclusive classification

Regular Jewel Desecration uses Desecration-domain rows applicable to jewel base tags. Classify the known display families as metadata for UI/search:

- `Lightless` -> `jewel_lightless`,
- `of the Abyss` -> `jewel_of_the_abyss`.

These are not Lich pools and are incompatible with Lich-specific forcing Omens.

Time-Lost/special jewels remain separate unsupported/custom systems unless a dedicated spec is added.

## 7.8 Effective tags for ordinary regular-affix eligibility

For normal-domain modifiers, calculate ordinary spawn eligibility from:

```text
base.tags
+ adds_tags from confidently identified existing modifiers
+ explicitly modeled crafting-state tags
```

Then apply RePoE's ordered `spawn_weights` semantics. If current modifiers cannot be identified confidently enough to know their `adds_tags`, diagnostics must state that conditional pool analysis may be incomplete.

## 7.9 Data-build validation gates

`npm run data:update` must fail or require explicit review when any of these occur:

- RePoE schema no longer matches the adapter.
- `desecrated` domain disappears or radically changes shape.
- a Lich-name row is contradictory and not covered by the curated override/audit policy.
- an Otherworldly row lacks the expected `breach_desecration` gate.
- a normalized modifier has no stable side/type/groups/stat identity.
- a stable ID changes category between snapshots without appearing in semantic diff.
- any production base item or modifier has an empty/missing `sourceRefs`.
- any Bone, Omen, compatibility rule or curated exception lacks an evidence reference and confidence level.
- a production entity exists only because it was hardcoded from prose/model memory rather than imported or explicitly evidenced.
- an unresolved source conflict would otherwise be converted into a confident runtime rule.
- a test-only/synthetic entity is detected in the production data-pack output.

The generated semantic diff must summarize at least:

- added/removed base items,
- added/removed modifiers,
- changed required levels,
- changed groups/types,
- changed spawn weights,
- changed Lich classification,
- changed Otherworldly membership,
- changed Bone/Omen currency definitions.

---

## 7.10 Reference data-build algorithms and required semantics

The pseudocode in this section is a **reference implementation**, not a mandatory code shape. Claude Code may use different algorithms, indexes, data structures, or decomposition if the requirements in section 0.1 are satisfied.

What **is required** is the semantic behavior described around each example: source ordering where relevant, classification precedence, special-context handling, family fallback behavior, provenance, and explainability.

### Ordinary spawn-weight resolution

```ts
function resolveOrdinarySpawnWeight(
  mod: RawMod,
  effectiveTags: ReadonlySet<string>,
): number | null {
  for (const entry of mod.spawn_weights) {
    if (effectiveTags.has(entry.tag)) return entry.weight;
  }
  return null;
}
```

`null` or `0` means not ordinarily spawnable. Do not sort `spawn_weights`; preserve source order.

### Lich classification

```ts
function classifyLichPool(mod: RawMod): LichPool | undefined {
  const override = LICH_POOL_OVERRIDES[mod.id];
  if (override) return override;

  if (mod.name === "Amanamu's" || mod.name === 'of Amanamu') return 'amanamu';
  if (mod.name === "Ulaman's"  || mod.name === 'of Ulaman')  return 'ulaman';
  if (mod.name === "Kurgal's"  || mod.name === 'of Kurgal')  return 'kurgal';

  return undefined;
}
```

After classification, compare against source tags and emit audit diagnostics for contradictions. Do not silently mutate the result based only on a contradictory tag.

### Otherworldly index

```ts
function isOtherworldly(mod: RawMod): boolean {
  return mod.domain === 'desecrated'
    && mod.spawn_weights.some(x => x.tag === 'breach_desecration' && x.weight > 0);
}

function otherworldlyJewelleryClasses(mod: RawMod): Set<'amulet'|'ring'|'belt'> {
  return new Set(
    mod.spawn_weights
      .map(x => x.tag)
      .filter((tag): tag is 'amulet'|'ring'|'belt' =>
        tag === 'amulet' || tag === 'ring' || tag === 'belt'
      )
  );
}
```

The zero ordinary base weight is not discarded here: it is part of the special-context encoding that prevents the modifier from appearing with an ordinary Collarbone.

### Minimum Modifier Level family filter

```ts
function applyMinimumModifierLevel(
  candidates: ModifierDefinition[],
  minimum: number,
): ModifierDefinition[] {
  const byFamily = groupBy(candidates, x => x.tierFamilyId);
  const out: ModifierDefinition[] = [];

  for (const family of byFamily.values()) {
    const atOrAboveFloor = family.filter(x => x.requiredLevel >= minimum);
    if (atOrAboveFloor.length > 0) {
      out.push(...atOrAboveFloor);
      continue;
    }

    const highest = maxBy(family, x => x.requiredLevel);
    if (highest) out.push(highest);
  }

  return out;
}
```

Input candidates must already be item-level eligible. This function is not the item-level gate.

### Pool construction separation

The implementation must preserve **stage-level explainability and diagnostics**. The reference design keeps intermediate candidate sets rather than one opaque `filter()` chain:

```text
regularBasePool
naturalDesecratedPool
otherworldlyExtensionPool (optional)
forcedLichSubset (optional)
postItemLevelPool
postMinimumLevelPool
postGroupBlockPool
finalEligiblePool
blockedWithReasons
```

Each transition must be unit-testable independently.

---

# 8. Parsed item domain model

```ts
interface ParsedItem {
  parserLocale: 'en' | 'unknown';
  copyMode: 'normal' | 'advanced' | 'unknown';
  rawText: string;

  rarity: 'normal' | 'magic' | 'rare' | 'unique' | 'unknown';
  itemName?: string;
  baseTypeText: string;
  baseItemId?: string;
  itemClassId?: string;
  itemLevel?: number;
  baseTags: string[];

  corrupted: boolean;
  mirrored: boolean;
  unidentified: boolean;

  prefixes: ParsedAffix[];
  suffixes: ParsedAffix[];
  unknownAffixes: ParsedAffix[];

  abyss: {
    hasUnrevealedDesecratedModifier: boolean;
    hasRevealedDesecratedModifier: boolean;
    desecratedSide?: AffixSide;
    hasMarkOfAbyssalLord: boolean;
    markSide?: AffixSide;
    isSpecialMultiDesecrationItem: boolean;
  };
}

interface ParsedAffix {
  rawLines: string[];
  side: AffixSide | 'unknown';
  matchedModifierId?: string;
  groups: string[];
  fractured: boolean;
  crafted: boolean;
  desecrated: boolean;
}
```

---

# 9. Clipboard parser

## 9.1 Supported input

MVP:

- English PoE2 item clipboard only.

Both normal and advanced copies should be accepted.

The parser implementation must use an adapter registry so DE and other locales can be added later without changing the normalized item model or crafting engine.

Advanced copy is preferred because it exposes more modifier detail and allows more reliable current-mod/group matching.

## 9.2 Parser pipeline

```text
raw clipboard
  -> normalize line endings / invisible chars
  -> detect locale
  -> split sections on PoE item separators
  -> parse header/class/rarity/base/item-level
  -> parse flags and properties
  -> parse affix blocks
  -> map localized game terms to canonical IDs
  -> identify current mod IDs/groups when possible
  -> detect Abyss state
  -> produce ParsedItem + ParserDiagnostics
```

## 9.3 Locale detection

Do not use UI language to infer clipboard language.

Use registered parser adapters. In MVP only the EN adapter can produce a supported parse. If detection does not confidently match EN, return `UNSUPPORTED_CLIPBOARD_LOCALE` rather than trying to reinterpret localized labels as English. Future locale adapters can participate in the same detection registry.

## 9.4 Parser accuracy states

```ts
type ParserConfidence = 'full' | 'partial' | 'insufficient';
```

- `full`: base, item level, side and current mod groups identified sufficiently for blocker-aware pool calculation.
- `partial`: base and item level known, but one or more existing affix groups unresolved.
- `insufficient`: cannot safely calculate.

When parser confidence is partial, the UI may show a **base eligibility pool** but must visibly state that mod-group blocking can be incomplete. A partial parse must never be presented as the final blocker-aware `Eligible modifier pool`. If unresolved affix groups or side/capacity uncertainty could change eligibility, the implementation must either:

- expose the result under an explicit `base_eligibility_only` / equivalent completeness state, or
- return `unknown` and no final pool.

It is not acceptable to silently treat unresolved existing groups as if they did not exist.

## 9.5 Never silently guess a current mod ID

If a clipboard affix could map to multiple modifier IDs and advanced metadata is insufficient, keep it unresolved. The rules engine must then branch conservatively or mark blocker analysis incomplete.

---

# 10. Abyssal Bone definitions

## 10.1 Currency target groups

```ts
type BoneTargetGroup =
  | 'weapon_or_quiver'
  | 'armour'
  | 'jewellery'
  | 'jewel'
  | 'waystone';
```

Actual compatibility is resolved from normalized item class/tags, not from display strings.

## 10.2 Known Bone set

| Currency | Target | Rule | Status |
|---|---|---|---|
| Gnawed Jawbone | Weapon or Quiver | Item level <= 64 | verified |
| Preserved Jawbone | Weapon or Quiver | normal Desecration | verified |
| Ancient Jawbone | Weapon or Quiver | Minimum Modifier Level 40 | verified |
| Gnawed Rib | Rare Armour | Item level <= 64 | verified |
| Preserved Rib | Rare Armour | normal Desecration | verified |
| Ancient Rib | Rare Armour | Minimum Modifier Level 40 | verified |
| Gnawed Collarbone | Amulet/Ring/Belt | Item level <= 64 | verified |
| Preserved Collarbone | Amulet/Ring/Belt | normal Desecration | verified |
| Ancient Collarbone | Amulet/Ring/Belt | Minimum Modifier Level 40 | verified |
| Preserved Cranium | Rare Jewel | jewel Desecration | verified |
| Altered Collarbone | Amulet/Ring/Belt | allows chance for Otherworldly modifiers | verified |
| Preserved Vertebrae | Rare Waystone | Waystone Desecration; currently drop-disabled | verified secondary |

Source:

- https://www.poe2wiki.net/wiki/Preserved_bone

## 10.3 Ancient minimum modifier level

Verified behavior:

- Reveal options are normally at least modifier level 40.
- Item-level eligibility is still respected.
- If filtering below level 40 would remove every tier of a modifier family, keep the highest item-level-eligible tier of that family even if it is below 40.

Algorithm for regular tiered affixes:

1. Start with all item-level-eligible tiers in a `tierFamilyId`.
2. Keep tiers where `requiredLevel >= 40`.
3. If any remain, use them.
4. If none remain but the family had at least one item-level-eligible tier, keep the highest eligible tier.

Do not apply this rule to a forced Lich Omen; current mechanics evidence says the Lich Omen overrides/redundantly bypasses the Ancient minimum-level benefit.

Sources:

- https://www.poe2wiki.net/wiki/Ancient_Jawbone
- https://www.poe2wiki.net/wiki/Ancient_Rib
- https://www.poe2wiki.net/wiki/Ancient_Collarbone

## 10.4 Altered Collarbone

Treat as a Jewellery Desecration mode with the additional `otherworldly` eligible pool.

Otherworldly modifiers are identified from game-derived tags such as `breach_desecration`.

The tooltip says they have a chance to appear. The application must show **eligibility**, not probability.

Lich force Omens are incompatible with Altered Collarbone.

---

# 11. Abyss Omen definitions

## 11.1 Omens affecting this product

| Omen | Phase | Effect |
|---|---|---|
| Omen of Sinistral Necromancy | Desecrate | force prefix side |
| Omen of Dextral Necromancy | Desecrate | force suffix side |
| Omen of the Liege | Desecrate | force Amanamu pool when possible; Weapon/Jewellery Desecration only |
| Omen of the Sovereign | Desecrate | force Ulaman pool when possible; Weapon/Jewellery Desecration only |
| Omen of the Blackblooded | Desecrate | force Kurgal pool when possible; Weapon/Jewellery Desecration only |
| Omen of Putrefaction | Desecrate | replace all modifiers with up to max Unrevealed modifiers and corrupt |
| Omen of Abyssal Echoes | Reveal | reroll reveal choices once; does not change eligibility pool |
| Omen of Light | Annul | next Annul removes only Desecrated modifiers; recovery helper, not pool modifier |

Sources:

- https://www.poe2wiki.net/wiki/Omen
- https://www.poe2wiki.net/wiki/Omen_of_the_Liege
- https://www.poe2wiki.net/wiki/Omen_of_Putrefaction
- https://www.poe2wiki.net/wiki/Omen_of_Abyssal_Echoes
- https://www.poe2wiki.net/wiki/Omen_of_Light

## 11.2 Side Omens

Sinistral and Dextral constrain the side of the Unrevealed modifier.

They may combine with a compatible Lich force Omen.

Example conceptual intersection:

```text
base eligibility
  AND suffix
  AND amanamu
```

## 11.3 Lich force Omens

The three Lich Omens are constrained by **Desecration currency family**, not simply by the existence of that Lich's modifiers on a base.

Compatible Bone families:

- Jawbone: yes.
- ordinary Collarbone: yes.
- Rib: no.
- Cranium: no.
- Vertebrae: no.
- Altered Collarbone: no.

Important behavior:

- If eligible forced-Lich modifiers exist, the forced pool is that Lich pool filtered by all other constraints.
- Other Lich pools are blocked.
- If no modifier of the forced Lich is possible, the Omen can still be consumed and reveal can fall back to regular modifiers according to current Wiki mechanics. Return a high-visibility warning.
- Gnawed Jawbone/Collarbone can technically pair with a Lich Omen, but Lich mods require ilvl 65 while Gnawed only accepts ilvl <=64, so the forced Lich pool is empty. Mark this `valid_with_warning`, not `invalid`.
- Ancient Jawbone/Collarbone with a Lich Omen is legal but the Ancient minimum-level advantage is redundant/overridden. Mark `valid_with_warning`.

## 11.4 Omen of Abyssal Echoes

Does not alter the eligible modifier pool.

UI displays:

- reveal options: three,
- reroll available once.

Do not double pool size.

## 11.5 Omen of Light

Not part of the Desecration pool calculation.

If item has a revealed Desecrated modifier, UI may show a recovery hint:

`Omen of Light + Orb of Annulment` -> removes only Desecrated modifier.

## 11.6 Putrefaction

Separate mode.

Verified:

- replaces all non-protected modifiers on the item,
- attempts maximum number of Desecrated modifiers allowed by the base, usually six,
- fractured item usually results in five generated slots because fractured modifier remains,
- corrupts the item,
- does not roll Desecration-exclusive modifiers,
- Ancient bone does not cause every generated modifier to respect the minimum 40 floor.

MVP must therefore use regular-affix pools for Putrefaction and exclude all `desecrated_exclusive`, Lich, Otherworldly and jewel-exclusive sources unless later evidence explicitly says otherwise.

**Altered Collarbone + Putrefaction is `ASSUMPTION_BLOCKED` until manually validated.** Do not claim a pool for this combination.

---

# 12. Essence of the Abyss / Mark of the Abyssal Lord

## 12.1 Detection

Parser must detect the Mark of the Abyssal Lord:

- prefix form `Abyssal`, or
- suffix form `of the Abyss`,

Do not confuse this Mark with jewel-exclusive `of the Abyss` without contextual/mod-ID matching.

## 12.2 Known behavior

Using an Abyssal Bone on an item with a non-fractured Mark attempts to replace the Mark first with an Unrevealed Desecrated modifier.

The Mark applies a higher-tier filter that appears to cull modifier options below approximately 40% of item level, subject to minimum-modifier-level family fallback behavior.

For an ilvl 80 item, this is approximately level 32.

Represent this as:

```ts
markMinimumLevel = floor(itemLevel * 0.40)
```

until a more authoritative exact rounding rule is established.

The Lich force Omen overrides/reduces the relevance of this minimum-level filtering according to current mechanics documentation.

Source:

- https://www.poe2wiki.net/wiki/Essence_of_the_Abyss

## 12.3 Required caution

The exact interaction of a forced side Omen with a Mark on the opposite side is not sufficiently documented in the current evidence set.

Until manually validated:

- same-side Mark + side Omen: calculate normally.
- opposite-side Mark + side Omen: return `UNKNOWN_MARK_SIDE_INTERACTION` and do not claim a final exact pool.

---

# 13. Modifier eligibility model

## 13.1 Two distinct candidate sources

Ordinary one-slot Desecration reveal may draw from:

1. **Regular affixes** that the base can normally roll.
2. **Desecration-exclusive affixes** valid for that base/side.

When appropriate, the exclusive category includes named Amanamu/Ulaman/Kurgal mods.

Altered Collarbone additionally introduces Otherworldly/Breach Desecration modifiers.

## 13.2 Regular mod eligibility

A regular mod is eligible only if all are true:

- generation type is prefix/suffix as needed,
- domain is appropriate,
- item base tags produce a positive spawn weight,
- `requiredLevel <= itemLevel`, subject to source mechanics,
- it does not conflict with groups already present after the Desecration branch's removal step,
- Bone minimum-level rules allow it,
- source-specific restrictions allow it.

### Spawn-weight tag evaluation

Use ordered spawn-weight semantics: base tags are matched against the mod's ordered spawn-weight rules; more specific/left-most matching tags take precedence. Weight zero means the mod is not spawnable for that context.

Do not use raw weights to show exact probabilities.

## 13.3 Exclusive mod eligibility

Exclusive Abyss-domain mods are filtered by:

- matching base tags/spawn rules,
- required item level,
- side,
- mod-group conflicts,
- exclusive-source rules,
- forced Lich Omen if present.

Known global exceptions:

- Body Armour, Helmet, Gloves and Boots have no exclusive Desecrated prefixes.
- Sceptres have no exclusive Desecrated prefixes or suffixes.
- Regular jewel exclusive mods use Lightless / `of the Abyss` style pools.
- Time-Lost Jewels do not use the regular jewel exclusive pool and require dedicated handling.

Sources:

- https://www.poe2wiki.net/wiki/Desecrated_modifier
- https://poe2db.tw/Desecrated_Modifiers

## 13.4 Modifier-level semantics

Keep three different concepts separate:

1. **Item-level eligibility**: a candidate's `requiredLevel` must normally be <= item `itemLevel`. This remains relevant for named Lich mods (commonly level 65); Lich Omen documentation explicitly notes failure when the desired Lich pool is impossible due to insufficient item level.
2. **Minimum Modifier Level floor** from Ancient Bones: does not simply delete an entire low-level modifier family; apply the family fallback rule from section 10.3.
3. **Mark of the Abyssal Lord floor**: approximate floor `floor(itemLevel * 0.40)` with the same family-fallback concept, pending exact-rounding validation.

If a Lich force Omen is active, current documentation says it overrides the Ancient/Mark minimum-level benefit. Item-level eligibility itself is **not** waived.

Do not replace these mechanics with a single generic level filter.

## 13.5 Mod groups

Modifiers sharing a group/family are mutually exclusive.

For every candidate modifier:

```text
candidate.groups INTERSECT remainingExisting.groups
```

If non-empty -> block candidate with reason `MOD_GROUP_CONFLICT`.

Blocked result must report the conflicting existing affix/mod ID when known.

---

# 14. Branch-aware Desecration behavior and reference algorithm

A copied item can produce different valid pools depending on which affix slot is removed and which side becomes Desecrated. The **required behavior** is to preserve these distinct possible outcomes instead of collapsing uncertain states into a false single answer.

The branch-enumeration approach below is the current reference design. Claude Code may instead use a state machine, decision graph, constraint model, immutable transition system, or another representation if it can justify the improvement and still expose equivalent branch-specific eligibility, blocked reasons, and provenance. A different internal representation must not merge outcomes in a way that makes the UI less precise.

## 14.1 Pre-validation

Reject ordinary Bone use if:

- item is not Rare, unless a separately supported special exception exists,
- item is corrupted,
- item already has a Desecrated modifier,
- selected Bone target group is incompatible,
- required item level constraint fails,
- incompatible Lich Omen + Bone family,
- parser confidence is insufficient to identify the base.

Return `unsupported` rather than `invalid` for recognized special unique systems not implemented by MVP.

## 14.2 Determine target side constraints

```text
Sinistral -> prefix only
Dextral -> suffix only
neither -> prefix and/or suffix depending on available/removable slots
```

Sinistral + Dextral together is not a meaningful compatible combination. UI should prevent selecting both and domain should return `CONFLICTING_SIDE_OMENS` defensively.

## 14.3 Determine replacement/removal branches

### Case A — non-fractured Mark of the Abyssal Lord exists

Bone attempts to replace Mark first.

- Mark prefix -> prefix branch.
- Mark suffix -> suffix branch.
- same-side side Omen -> valid.
- opposite-side side Omen -> currently `UNKNOWN_MARK_SIDE_INTERACTION` until manually validated.

### Case B — chosen/possible side has an open affix slot

No ordinary affix removal is needed for that side.

Create branch with existing mods unchanged and reserve one slot for Unrevealed Desecrated modifier.

### Case C — target side is full

Desecration must free a modifier slot on that side.

Create one branch per removable non-fractured affix on that side.

Each branch recalculates mod-group blocking after that affix is removed.

### Case D — no side Omen and both sides possible

Generate all valid prefix and suffix branches.

If the item is fully affixed, model possible removal branches rather than a single aggregate pool.

**Unresolved mixed-capacity case (U-012):** if one side has an open slot while the other side is full and no side Omen is active, the current evidence does not establish whether Desecration can also choose the full side and remove an affix. Until verified, the MVP must not present one interpretation as a complete final pool. Use `unknown` with no final pool (or an explicitly non-final known-subset representation if a future spec introduces one).

### Fractured affixes

Treat fractured affixes as protected/non-removable for branch generation. If a craft requires a removal but no non-fractured affix is available on the required side, return a conservative unsupported/invalid diagnostic pending manual confirmation of the exact in-game error behavior.

## 14.4 Calculate candidate pool per branch

For each branch:

1. Resolve side.
2. Resolve remaining existing groups.
3. Build ordinary regular-affix pool for that base/side using effective tags and ordered ordinary spawn-weight semantics.
4. Build natural `domain == desecrated` exclusive pool for that base/side.
5. If Altered Collarbone, add the separately indexed Otherworldly pool; do not use ordinary base-spawn evaluation for this unlock.
6. Apply item-level requirements.
7. Apply Ancient/Mark modifier-level family-floor logic where applicable.
8. Apply mod-group blocking against post-removal item state.
9. Apply Lich force Omen behavior using normalized `lichPool` classification if active.
10. Produce eligible and blocked lists with reasons and data-provenance flags.

## 14.5 Lich force resolution

If Lich Omen active:

1. Verify Bone-family compatibility.
2. Build candidates matching the forced Lich source.
3. Apply side/item-level/group filters.
4. If at least one exists: `effectivePool = forcedLichCandidates`.
5. If zero exist: set warning `FORCED_LICH_POOL_EMPTY`; use the documented regular fallback pool rather than claiming the forced source is possible.

Natural Lich mods remain part of ordinary exclusive pools when no Lich force Omen is active and the base can naturally roll them.

## 14.6 Result structure

```ts
interface DesecrationEvaluation {
  status: 'valid' | 'valid_with_warning' | 'invalid' | 'unsupported' | 'unknown';
  reasons: Diagnostic[];
  branches: DesecrationBranchResult[];
  recoveryHints: RecoveryHint[];
  parserConfidence: ParserConfidence;
  dataManifest: DataManifestSummary;
}

interface DesecrationBranchResult {
  id: string;
  side: AffixSide;
  removedAffixId?: string;
  removedAffixRawText?: string[];
  eligible: ModifierCandidate[];
  blocked: BlockedModifierCandidate[];
  poolSummary: {
    regular: number;
    exclusive: number;
    amanamu: number;
    ulaman: number;
    kurgal: number;
    otherworldly: number;
    jewelExclusive: number;
  };
}
```

## 14.7 Base Desecration pool

Question answered: *which modifiers can the selected Bone + Omens produce on this base type at this
item level?* It is independent of the item's current modifiers and of every item-state detail that
the clipboard may not reveal.

Inputs: base (tags, domain), item class, item level, rarity, corrupted flag, detected existing
Desecration, Bone, Omens. Not used: current affixes, their groups and `adds_tags`, affix capacity,
removal branches, Mark of the Abyssal Lord and its floor, fractured state.

Checks (a failing check leaves no base pool):

- data pack validated; recognized special items stay `unsupported` (U-005, U-006);
- base, item class and item level identified;
- Bone known and compatible with the item class, Gnawed item-level limit, evidence present;
- Omen compatibility and combination rules (§11, §14.2), including U-002 for Putrefaction;
- evidenced item-level invalidity still applies: not Rare, corrupted, Desecration detected as present.

Undetermined item state (U-011, U-014, Mark or capacity undetermined, partial parse) does **not**
block the base pool; it only affects the exact item check.

Pool per side: a side Omen restricts the side; otherwise prefix and suffix. Each side uses the §14.4
stages with no existing affixes: ordinary eligibility from the base's own tags, natural exclusive
pool, Otherworldly for Altered Collarbone, item-level requirements, the Ancient floor (never the Mark
floor), Lich force per §14.5 with U-013 applied unchanged. Putrefaction uses regular sources only and
no floors (§11.6).

Semantics: the base pool is **not final**. Existing modifier groups can block entries, a Mark can
raise the floor, and tags added by existing modifiers can unlock entries that the base pool does not
list. The UI shows it as the primary list whenever no final item-specific pool exists, with a note
that the item's current modifiers are not taken into account. The exact item check status is shown
next to it whenever it is not `unknown`; an `unknown` exact check whose only consequence is that the
base pool is shown is not displayed (maintainer decision, 0.2.7).

---

# 15. Explainability and diagnostics

## 15.1 Every blocked candidate has reasons

Example reason codes:

- `WRONG_SIDE`
- `ITEM_LEVEL_TOO_LOW`
- `BELOW_MINIMUM_MODIFIER_LEVEL`
- `MOD_GROUP_CONFLICT`
- `BASE_TAG_NOT_ELIGIBLE`
- `SOURCE_NOT_ENABLED`
- `LICH_SOURCE_NOT_SELECTED`
- `OTHER_LICH_BLOCKED_BY_FORCE_OMEN`
- `PUTREFACTION_EXCLUDES_EXCLUSIVE`
- `SPECIAL_JEWEL_RULE`

## 15.2 Craft-level reason codes

Examples:

- `ITEM_NOT_RARE`
- `ITEM_CORRUPTED`
- `ITEM_ALREADY_DESECRATED`
- `BONE_INCOMPATIBLE_ITEM_CLASS`
- `GNAWED_ITEM_LEVEL_TOO_HIGH`
- `LICH_OMEN_INCOMPATIBLE_WITH_BONE`
- `FORCED_LICH_POOL_EMPTY`
- `ANCIENT_BENEFIT_OVERRIDDEN_BY_LICH_OMEN`
- `ALTERED_COLLARBONE_LICH_OMEN_CONFLICT`
- `CONFLICTING_SIDE_OMENS`
- `PARSER_PARTIAL_MOD_GROUPS`
- `UNKNOWN_MARK_SIDE_INTERACTION`
- `UNKNOWN_ALTERED_PUTREFACTION_INTERACTION`
- `UNSUPPORTED_SPECIAL_ITEM`

## 15.3 Diagnostics must be serializable

Provide `Copy debug report` in UI.

Debug report may include:

- app version,
- data manifest version,
- parser locale/confidence,
- normalized base ID,
- selected currency/Omen IDs,
- reason codes,
- branch counts,
- raw clipboard only after explicit user consent/action.

Do not silently upload telemetry in MVP.

---

# 16. UI/UX decisions

## 16.1 Default hotkey

Default overlay hotkey:

**`Alt + T`** (maintainer decision, 0.2.12; before: `Ctrl + Shift + D`)

Reason: one hand, next to the price-check habit of other overlays, and it avoids the common `Ctrl+D`
pricing overlay conflict. Stored settings on Ctrl+Shift+D (in any spelling) move to `Alt+T` once;
other custom hotkeys are kept.

Hotkey must be configurable.

The hotkey only opens/toggles this application; it must not send input to PoE2.

With auto-copy (§3.1) every hotkey press copies the hovered item first. While the overlay is visible,
pressing the hotkey reads the clipboard once. If the text differs from
the item currently shown, the overlay shows the new item and stays open; otherwise it hides. This lets
the player copy the next item and press the hotkey once. The overlay also offers an explicit
"read clipboard" button and hides on `Escape`.

## 16.2 On open

1. Read clipboard once.
2. Attempt parse.
3. If valid PoE2 item -> show craft workspace.
4. If not -> show concise instruction to copy a PoE2 item and retry.

Do not continuously poll the clipboard in MVP.

## 16.3 Window behavior

- frameless overlay,
- always-on-top,
- draggable header,
- remembered position and size,
- default compact width approximately 520–620 px,
- expandable detail area,
- no copyrighted PoE2 artwork required,
- dark Abyss-inspired theme (deep ink background, abyssal green accent, violet for Desecrated/exclusive
  sources) built from app-owned CSS only; no PoE2 artwork or asset clone.

Do not auto-close immediately when focus changes; use explicit close/toggle plus optional setting `closeOnBlur` default `false`.

Keyboard focus (maintainer decision, 0.2.12): on Windows the overlay window does not take keyboard
focus, so clicking its controls leaves the game focused and the next hotkey copy reaches the game.
Only while the player presses a text field (search, level filters, settings) the overlay takes focus,
and gives it up when the field loses focus. `Escape` therefore works while typing; otherwise the
overlay closes with the hotkey on the same item or the close button.

Responsiveness (0.2.13): the hotkey shows the overlay at once with a loading state (dimmed window,
spinning app diamond) while the game copies the item; the renderer is not background-throttled.

## 16.4 Main layout

All production Bone/Omen/base/modifier labels and selectable game-entity options must be generated from the versioned data pack/rule registry. UI mockups may show real names for illustration, but component code must not contain a second hand-written catalog or hardcoded fallback list of PoE2 entities.


### Layout (0.2.9)

Three columns on a wide window: craft choices (Bones, Omens) on the left, the modifier list with its
filter chips in the centre, the item preview on the right. On a narrow window they stack, item first.

### Header / item preview

- base/game item name,
- rarity,
- item level,
- item class,
- parser confidence badge, shown only when parsing was not full (0.2.7),
- data version badge (setting),
- free prefix/suffix slots, from the evidenced per-class affix limits; marked as counted from the
  recognized modifiers while existing Desecration is undetermined (U-011, U-014), and not shown when
  a side is unknown (0.2.9),
- the item's modifiers as in the game tooltip; a modifier picked from the eligible list is shown on
  it as a labelled Desecrated preview (not a craft result, no probability) (0.2.9).

### Craft controls

- Bone selector (dropdown or single-choice chip group) listing only the currencies usable on the
  item; incompatible ones are not shown (0.2.8). Legacy currencies appear only with the setting.
- Omen multi-select grouped by phase:
  - Desecrate,
  - Reveal,
  - Recovery.
- Defaults for a new item (maintainer decision, 0.2.11): the Bone last chosen for the item's target
  group, otherwise the usable non-legacy Bone without an item-level limit or minimum-modifier-level
  floor (data fields, pack order); the side filter shows only the side with free slots when exactly
  one side has them, with a note that choosing the full side is unverified (U-012). Defaults are
  view choices, never recommendations about outcomes; the user can change them. A Bone the user
  deselects stays deselected for that item.
- Omens that cannot be used with the chosen Bone (or with any Bone usable on the item) are not
  shown (0.2.9); incompatible Omen combinations stay disabled with tooltip/reason.

### Result summary

- `Valid`, `Warning`, `Invalid`, `Unsupported`, or `Unknown`.
- side/branches.
- major warnings.
- eligible count.

### Modifier view

Two top-level views:

- `Eligible`
- `Blocked`

Filters:

- search text,
- Prefix/Suffix,
- Regular,
- Exclusive,
- Amanamu,
- Ulaman,
- Kurgal,
- Otherworldly,
- min/max required level.

Rows show:

- localized official mod text when available,
- side,
- required level,
- source badge,
- branch availability,
- reason if blocked.

## 16.5 Multiple branches

If a full item can remove different mods, do not merge pools without context.

UI should show:

```text
Possible removal outcomes (3)
[Removed Prefix A]
[Removed Prefix B]
[Removed Prefix C]
```

A `Union` view may be offered as a convenience but must label whether a modifier is possible in `1/3`, `2/3`, etc. branches. This is not a probability statement; it is branch coverage only.

## 16.6 Target-mod search

Search is part of MVP.

User can type, for example, `Spirit` and see:

- whether matching mods are eligible,
- which branch(es),
- source,
- why a desired mod is blocked if not eligible.

## 16.7 Settings

Settings include:

- UI language,
- game terminology language,
- clipboard locale auto/manual,
- overlay hotkey,
- close on blur,
- auto-copy on hotkey (`autoCopy`, default on, §3.1),
- show legacy currencies,
- display data version,
- check for updates (`checkForUpdates`, default on, §3.5),
- reset window position.

## 16.8 Release notes after an update

After an update, the overlay opens once and shows a small dialog with the release notes in the UI
language. The notes are UI texts bundled with the app (one entry per release, EN and PL). Closing the
dialog marks the notes as read. A fresh install does not show them.

---

# 17. Probability policy

## 17.1 No exact percentages in MVP

PoE2DB currently notes that modifier weight information is not fully obtainable for this system, and the PoE2 Wiki notes exclusive Desecrated weights appear uneven.

Therefore:

- do not display roll percentages,
- do not infer equal probability,
- do not use candidate count as chance,
- do not market branch coverage as probability.

## 17.2 Reveal guarantee informational note

Current mechanics indicate that at least one exclusive Desecrated option is offered when an appropriate exclusive modifier exists and level conditions are met.

This can be displayed as a mechanic note, but the MVP does not simulate the three-choice reveal sampler.

---

# 18. Test strategy

## 18.1 Unit tests — data adapter

Test:

- base tag normalization,
- item class mapping,
- spawn-weight evaluation,
- source classification,
- tier-family construction,
- EN game-term provider integrity and future-provider fallback contract.

Synthetic fixtures are allowed for unit isolation only and must use clearly artificial IDs/names (for example `TEST_ONLY_*`). They must not mirror or masquerade as canonical production IDs. Real-data behavior is verified separately against the versioned snapshot/data pack.

## 18.2 Unit tests — parser

At minimum fixtures for:

- EN Rare Body Armour normal copy,
- EN Rare Body Armour advanced copy,
- weapon,
- quiver,
- ring,
- amulet,
- belt,
- jewel,
- item with full prefixes,
- item with full suffixes,
- six-affix item,
- fractured affix,
- unrevealed Desecrated modifier,
- revealed Desecrated modifier,
- Mark of the Abyssal Lord.

Future locale adapters must add cross-locale canonical-equivalence fixtures when implemented.

## 18.3 Unit tests — rules engine mandatory cases

1. Rare Ornate Plate + Preserved Rib -> valid.
2. Ornate Plate + Preserved Rib + Omen of the Liege -> invalid compatibility.
3. Ornate Plate + Preserved Rib + Dextral -> suffix branch only.
4. Armour with open prefix but full suffix + Dextral -> suffix replacement branches, not prefix branch.
5. Bow ilvl 82 + Preserved Jawbone + Liege + Sinistral -> Amanamu prefix pool if eligible.
6. Bow ilvl 82 + Preserved Jawbone + Liege + Dextral -> Amanamu suffix pool if eligible.
7. Weapon ilvl 64 + Gnawed Jawbone + Liege -> valid with warning, forced Lich pool empty.
8. Jewellery ilvl 64 + Gnawed Collarbone + Sovereign -> valid with warning, forced Lich pool empty.
9. Jewellery + Ancient Collarbone + Blackblooded -> valid with Ancient benefit overridden warning.
10. Jewellery + Altered Collarbone + Lich force Omen -> invalid.
11. Jewellery + Altered Collarbone + Dextral -> eligible ordinary + Otherworldly suffix pool.
12. Existing Desecrated item + ordinary Bone -> invalid.
13. Corrupted rare + Bone -> invalid.
14. Non-rare ordinary item + Bone -> invalid.
15. Existing group blocker prevents matching candidate -> candidate appears under Blocked with `MOD_GROUP_CONFLICT`.
16. Full affix side with multiple removable mods -> multiple branches.
17. Ancient Bone retains highest below-40 tier if a tier family would otherwise disappear.
18. Putrefaction -> exclusive sources excluded.
19. Echoes -> pool unchanged; reveal reroll metadata set.
20. Light -> pool unchanged; recovery hint set.
21. PL UI -> official EN game terms.
22. Switching EN/PL UI does not change domain result.
23. Registering a synthetic test locale/provider does not require domain/rules-engine changes.
24. Partial parser state with unresolved existing mod groups is never rendered as a complete blocker-aware eligible pool.
25. An `ASSUMPTION_BLOCKED` interaction returns `unknown` (or an explicitly non-final subset state), never a confident final pool.
26. Synthetic test entities are clearly `TEST_ONLY`-namespaced and validation proves none can enter the production data pack.
27. Production UI selectors are data-driven; no independent hardcoded Bone/Omen/base/mod catalog exists in renderer code.
28. Release validation fails if the required real snapshot/data pack is absent; release checks may not silently skip real-data tests.

## 18.4 Integration tests

- clipboard text -> parser -> normalized item -> rules engine -> view model.
- changing UI language must not change domain result.
- replacing the game-term provider must not change domain result.

## 18.5 UI tests

- invalid combinations cannot be accidentally represented as valid.
- branch selector changes visible pool.
- blocked reason tooltip/message exists.
- language switching is live and does not require restart.
- all EN/PL UI keys exist and match the same key schema.

## 18.6 Desktop smoke tests

- application starts on Windows 10/11.
- global hotkey toggles overlay.
- clipboard is read on invocation.
- window stays above Windowed Fullscreen PoE2.
- saved position restored.
- packaged unsigned `.exe` starts after normal SmartScreen bypass.

---

# 19. Manual validation required from the human maintainer

Claude Code cannot validate these in the live game.

## 19.1 Clipboard fixture capture

Human must collect real clipboard text from PoE2 for:

- English normal copy and advanced copy of a Rare Ornate Plate.
- at least one weapon.
- one ring/amulet/belt.
- one jewel.
- item with an unrevealed Desecrated modifier.
- item with a revealed Desecrated modifier.
- item carrying Mark of the Abyssal Lord.
- item with fractured modifier if available.

Save verbatim fixtures. Do not hand-edit them except for a separate annotated copy.

## 19.2 Well of Souls validation matrix

Human should verify at least:

- Preserved Rib on armour.
- Dextral and Sinistral side behavior with a full targeted side.
- Preserved Jawbone + one Lich force Omen.
- Lich force Omen + incompatible Rib error.
- Gnawed + Lich Omen empty forced pool behavior.
- Altered Collarbone + side Omen.
- Mark of the Abyssal Lord replacement side behavior.
- Mark + opposite-side Necromancy Omen (currently unknown).
- Altered Collarbone + Putrefaction (currently unknown).
- no-side-Omen item with one side open and the opposite side full (U-012).
- whether a revealed Desecrated affix that comes from the ordinary/regular mod pool remains explicitly detectable in normal and advanced clipboard text (U-014).

Record:

- item before,
- active Omen(s),
- currency,
- game error if any,
- item after applying currency,
- Well of Souls offered choices.

## 19.3 Overlay validation

Human must test:

- PoE2 Windowed Fullscreen.
- overlay hotkey conflict with existing tools.
- multiple monitors if used.
- DPI scaling at 100%, 125%, 150% if possible.
- EN client clipboard parsing.
- Future locale parsing is tested only when that locale is implemented.

## 19.4 Packaging/signing

MVP may be unsigned. Human will need to bypass Windows SmartScreen when testing unsigned builds.

Code signing is a post-MVP distribution decision.

A release build must run a non-skippable real-data validation gate. Tests that are allowed to skip when no RePoE snapshot is present during ordinary CI/dev must fail the release workflow if the production snapshot/data pack is missing or unvalidated.

---

# 20. Known uncertainties / blocked assumptions

These must not be silently resolved by an LLM.

## U-001 — Mark + opposite-side Necromancy Omen

Status: `ASSUMPTION_BLOCKED`.

Need live-game validation.

## U-002 — Altered Collarbone + Putrefaction

Status: `ASSUMPTION_BLOCKED`.

Need live-game validation.

## U-003 — exact rounding of Mark's 40%-of-ilvl floor

Current rule model uses `floor(itemLevel * 0.40)` as the working interpretation.

Must be replaced if better primary evidence becomes available.

## U-004 — exact reveal probabilities / exclusive weights

Unknown/not sufficiently extractable.

No probability UI.

## U-005 — special unique/multi-Desecration systems

Not normal MVP domain.

Return unsupported explicitly.

## U-006 — Time-Lost Jewels

Known to have separate restricted outcomes; do not treat as regular jewel. Dedicated spec required if implemented.

## U-007 — full-side removal/fractured corner cases

Working engine model treats fractured affixes as non-removable. Live-game edge cases should be manually validated.

## U-008 — Ancient Bone floor combined with Mark of the Abyssal Lord floor

Status: `ASSUMPTION_BLOCKED`.

The individual floor rules are documented, but their exact combination is not sufficiently verified. Until resolved, a craft state requiring both must return `unknown`; do not choose `max`, `min`, sequential application, or another plausible combination from intuition.

## U-009 — RePoE fields that identify Desecration-exclusive source categories

Status: `DATA_DISCOVERY_REQUIRED`.

This is not a live-game mechanic guess. Claude Code may resolve it autonomously during spec 002 by inspecting the accepted RePoE snapshot, recording the observed domain/generation/tag facts, and producing an evidenced `source-classification` mapping. The data build must fail closed while the mapping is unconfigured or contradictory.

## U-011 — exact EN clipboard markers for Desecrated/fractured states

Status: `NEEDS_MANUAL_FIXTURE`.

Exact normal-copy and advanced-copy markers must be confirmed from verbatim EN clipboard fixtures. Seed values from external parser implementations may be used only as unconfirmed references.

## U-012 — mixed open/full side behavior without a side Omen

Status: `ASSUMPTION_BLOCKED`.

When one side has an open slot and the opposite side is full, it is not yet verified whether Desecration may choose the full side and remove an affix. MVP behavior is `unknown` with no final eligible pool for this ambiguous state. Do not expose a chosen interpretation merely with a badge and still call it final.

## U-013 — forced Lich pool empty fallback combined with floors/exclusive sources

Status: `ASSUMPTION_BLOCKED`.

The documented regular fallback is insufficient to establish every interaction with Ancient/Mark modifier-level floors or non-forced exclusive sources. If those details can affect the result, return `unknown` rather than inventing the fallback composition.

## U-014 — detectability of a revealed regular-source Desecrated affix

Status: `NEEDS_MANUAL_FIXTURE`.

A revealed Desecrated affix may originate from the ordinary regular modifier pool, so `desecratedSource !== regular` is not sufficient to identify every already-Desecrated item. Real EN normal/advanced clipboard fixtures must establish whether the game emits a persistent Desecrated marker or other reliable metadata after reveal. Until then, the parser must not claim complete existing-Desecrated detection for regular-source reveals.

---

# 21. Example: Ornate Plate + Preserved Rib

Known current base data for Ornate Plate includes:

- class: Body Armours,
- metadata type: `Metadata/Items/Armours/BodyArmours/FourBodyStr6Endgame`,
- tags including `str_armour`, `body_armour`, `armour`.

PoE2DB reference:

- https://poe2db.tw/Ornate_Plate

For a Rare Ornate Plate:

1. Preserved Rib is target-compatible.
2. Natural exclusive Desecrated prefixes do not exist for Body Armour.
3. Natural exclusive suffixes may exist and can include named Lich-source modifiers when their spawn tags allow the base.
4. Omen of the Liege/Sovereign/Blackblooded cannot be used with Rib despite those named modifiers potentially existing in the natural armour pool.
5. Dextral constrains the new modifier to suffix.
6. Existing suffix groups and the branch's removed suffix must be considered before calculating the final suffix pool.
7. App must show regular suffix candidates plus naturally eligible exclusive suffix candidates.
8. App must not show exact chances.

This example is the first canonical integration fixture once real clipboard text is collected.

---

# 22. Release behavior and user messaging

## 22.1 First launch

Show short onboarding:

1. Copy a PoE2 item manually (`Ctrl+Alt+C` recommended).
2. Press overlay hotkey (`Alt+T`).
3. Choose Bone and Omens.
4. Review eligible pool and warnings.

## 22.2 Data freshness

If bundled data target is older than the app's configured target version or marked stale by developer metadata, show:

`Crafting data may be outdated for the current PoE2 patch.`

Do not silently query external sites.

## 22.3 Unknown mechanics

Use direct messaging such as:

`This interaction is not verified yet. The overlay will not guess the modifier pool.`

This is preferable to a plausible but false answer.

---

# 23. Claude Code spec-generation instructions

Claude Code should not implement the whole application from this file in one uncontrolled pass.

## 23.1 Project-level `CLAUDE.md` guardrails

Claude Code should create or maintain a concise project-level `CLAUDE.md` in the repository root. Its purpose is to keep the most important operational rules visible in every coding session without requiring the agent to rediscover them from the full Source of Truth.

`CLAUDE.md` is a **derived operational summary**, not a second source of truth. It must explicitly point back to this file and state that, if the two ever conflict, `POE2_ABYSS_OVERLAY_SOURCE_OF_TRUTH.md` wins.

The file should remain short and action-oriented. It should not duplicate the whole Source of Truth. At minimum it should preserve these project guardrails:

1. **Read the Source of Truth before material implementation changes.** Specs and code must not contradict it.
2. **Never invent PoE2 data or mechanics.** Do not create items, bases, currencies, Omens, modifiers, tiers, tags, levels, weights, compatibility rules, or names from model memory. Production game data must come from approved/versioned sources with provenance.
3. **Fail closed on uncertainty.** If evidence is missing or conflicting, return/record `unknown`, `unsupported`, `data_conflict`, or `needs_manual_validation`; never fill gaps with plausible guesses.
4. **Keep test-only fake data isolated.** Synthetic items/mods may exist in fixtures/tests only and must be impossible to include in production data packs.
5. **Preserve data provenance.** Any curated override or manually encoded game rule must carry an evidence reference and confidence/evidence status.
6. **Do not interact with the PoE2 process at runtime.** No process memory access, GGPK/runtime game-file parsing, input injection, screen automation, or gameplay automation. The runtime path is user clipboard -> overlay.
7. **Keep domain logic UI-independent.** Domain/rules code returns IDs, reason codes, parameters, and structured outcomes, not localized user-facing strings.
8. **MVP localization is EN + PL.** Official PoE2 game terms remain English in both languages. Do not invent Polish translations of game terminology. Keep locale architecture extensible for future languages.
9. **Exact craft probabilities are out of scope** unless a future verified source provides trustworthy weights. Never turn candidate counts or branch coverage into probability claims.
10. **Explain exclusions.** Every removed candidate modifier must have a machine-readable reason that the UI can explain.
11. **Algorithms are flexible; semantics are not.** Reference algorithms in the Source of Truth may be replaced by a better implementation if the alternative preserves required behavior, is justified, documents trade-offs, and is verified by tests.
12. **Do not silently change product/game semantics.** If an implementation idea requires changing a verified mechanic, scope boundary, safety rule, localization policy, or user-visible semantic behavior, update/review the Source of Truth instead of silently deviating.
13. **Specs before implementation for major work.** Follow the spec-generation workflow and dependency order defined below.
14. **Prefer deterministic, auditable transformations.** Data ingestion and normalization should be reproducible from versioned inputs, with validation gates that stop on structural or semantic conflicts.

A suitable initial `CLAUDE.md` may be generated directly from these rules, then adjusted as the repository evolves. Claude Code may add repository-specific commands, test instructions, folder conventions, and implementation notes, provided they do not weaken or contradict these guardrails.

When this Source of Truth changes materially, Claude Code should review whether `CLAUDE.md` needs a corresponding concise update. Do not automatically copy every new paragraph; only promote stable, high-value operational rules.

First create the following specs in `/specs/`, referencing decision IDs/sections from this document:

1. `001-app-shell-and-security.md`
   - Electron shell
   - preload/IPC boundary
   - overlay behavior
   - settings/hotkey
   - no game input/process interaction

2. `002-data-ingestion-and-normalization.md`
   - RePoE adapters
   - normalized base/mod schemas
   - source classification
   - manifest/versioning
   - data validation

3. `003-localization.md`
   - EN/PL UI
   - official EN game terminology
   - locale-provider/adapter extension contract for future DE/other locales
   - parser locale independence
   - EN/PL translation parity tests

4. `004-clipboard-item-parser.md`
   - EN grammar in MVP
   - parser-adapter registry for future locales
   - normal/advanced copy
   - affix matching
   - Abyss state detection
   - diagnostics/confidence

5. `005-desecration-rules-engine.md`
   - Bones
   - Omens
   - branch-aware removal
   - modifier eligibility
   - Ancient/Mark floors
   - Putrefaction
   - reason codes

6. `006-overlay-ui.md`
   - workspace layout
   - eligible/blocked views
   - branch selector
   - filters/search
   - warnings and data freshness

7. `007-testing-and-validation.md`
   - fixtures
   - unit/integration/UI tests
   - manual test matrix
   - regression workflow

8. `008-packaging-and-data-update.md`
   - Windows build
   - electron-builder
   - bundled data pack
   - developer update script
   - release checklist

Each spec must contain:

- goal,
- in-scope/out-of-scope,
- interfaces/contracts,
- acceptance criteria,
- tests,
- dependencies on other specs,
- unresolved items explicitly linked to `U-xxx` IDs,
- `Algorithm/design choice` for non-trivial domain or data-processing work: either adopt the Source-of-Truth reference design, or propose an alternative and justify it under section 0.1.

Claude Code should treat algorithms in this document as informed starting points. Before implementing a non-trivial algorithm, it may perform a short design review. If an alternative is objectively preferable for this project, Claude Code should state the alternative, why it is better, its trade-offs, and how equivalence will be tested. Human approval is not required for routine internal improvements that do not alter normative behavior, but the rationale must be recorded. Any proposal that changes a verified game rule, product scope, safety boundary, localization policy, or user-visible semantic behavior requires an explicit Source-of-Truth change instead of a silent implementation deviation.

Only after specs are reviewed should Claude Code implement them in dependency order.

Recommended implementation order:

`002 -> 003 -> 004 -> 005 -> 001 -> 006 -> 007 -> 008`

Data/domain work comes before visual polish.

---

# 24. Definition of done for MVP

MVP is done only when all are true:

- Real EN clipboard item parses.
- Ornate Plate + Preserved Rib produces a verified eligible pool.
- Side Omens correctly constrain branches.
- Lich Omen compatibility is correctly enforced.
- Natural Lich-source exclusive mods are not incorrectly removed from non-Lich-omen pools.
- Existing mod groups affect candidate eligibility.
- Full-side items create branch-aware results.
- Ancient level-floor behavior has automated tests.
- Altered Collarbone exposes Otherworldly eligibility without fake probabilities.
- Putrefaction is handled as a separate mode.
- EN/PL UI is complete.
- PL uses official EN game terms.
- Localization/parser extension contracts allow future DE without domain/rules-engine changes.
- UI/domain have no hardcoded localized business messages.
- Overlay works in PoE2 Windowed Fullscreen on the maintainer's Windows machine.
- No runtime game process/file access exists.
- No keyboard/mouse input is injected into PoE2.
- Public notice about GGG affiliation is included.
- Data manifest is visible.
- Unknown interactions remain visibly unknown rather than guessed.

---

# 25. Research/source ledger

Checked on 2026-09-26.

## GGG

- Developer docs / third-party policy: https://www.pathofexile.com/developer/docs

## RePoE PoE2

- Observed version on 2026-09-26: `4.5.5.2` from https://raw.githubusercontent.com/repoe-fork/poe2/master/version.txt
- Export index: https://repoe-fork.github.io/poe2/
- General RePoE: https://repoe-fork.github.io/
- Mods schema: https://repoe-fork.github.io/data-formats/mods.html
- Base items schema: https://repoe-fork.github.io/data-formats/base_items.html
- RePoE `mods_by_base` implementation / ordered spawn-weight reference and special-domain limitation: https://github.com/repoe-fork/repoe/blob/master/RePoE/parser/modules/mods_by_base.py

## PoE2 Wiki

- Desecrated modifier: https://www.poe2wiki.net/wiki/Desecrated_modifier
- Desecrated mod list: https://www.poe2wiki.net/wiki/List_of_desecrated_modifiers
- Preserved bones: https://www.poe2wiki.net/wiki/Preserved_bone
- Gnawed Jawbone: https://www.poe2wiki.net/wiki/Gnawed_Jawbone
- Gnawed Rib: https://www.poe2wiki.net/wiki/Gnawed_Rib
- Gnawed Collarbone: https://www.poe2wiki.net/wiki/Gnawed_Collarbone
- Ancient Jawbone: https://www.poe2wiki.net/wiki/Ancient_Jawbone
- Ancient Rib: https://www.poe2wiki.net/wiki/Ancient_Rib
- Ancient Collarbone: https://www.poe2wiki.net/wiki/Ancient_Collarbone
- Preserved Cranium: https://www.poe2wiki.net/wiki/Preserved_Cranium
- Omens: https://www.poe2wiki.net/wiki/Omen
- Liege: https://www.poe2wiki.net/wiki/Omen_of_the_Liege
- Sovereign: https://www.poe2wiki.net/wiki/Omen_of_the_Sovereign
- Blackblooded: https://www.poe2wiki.net/wiki/Omen_of_the_Blackblooded
- Sinistral Necromancy: https://www.poe2wiki.net/wiki/Omen_of_Sinistral_Necromancy
- Dextral Necromancy: https://www.poe2wiki.net/wiki/Omen_of_Dextral_Necromancy
- Putrefaction: https://www.poe2wiki.net/wiki/Omen_of_Putrefaction
- Abyssal Echoes: https://www.poe2wiki.net/wiki/Omen_of_Abyssal_Echoes
- Omen of Light: https://www.poe2wiki.net/wiki/Omen_of_Light
- Essence of the Abyss: https://www.poe2wiki.net/wiki/Essence_of_the_Abyss
- Version 0.5.0 crafting change: https://www.poe2wiki.net/wiki/Version_0.5.0

## PoE2DB

- Desecrated modifiers: https://poe2db.tw/Desecrated_Modifiers
- Ornate Plate: https://poe2db.tw/Ornate_Plate

## Clipboard/overlay implementation reference

- Exiled Exchange 2 quick start: https://github.com/Kvan7/Exiled-Exchange-2/blob/master/docs/quick-start.md
- Exiled Exchange 2: https://github.com/Kvan7/Exiled-Exchange-2

---

# 26. Changelog

## 0.2.13 — 2026-09-29

- §16.3: loading state during the hotkey copy; faster copy timing (spec 016).

## 0.2.12 — 2026-09-29

Maintainer feedback: the hotkey only worked after clicking the item in the game.

- §16.3: the overlay no longer takes keyboard focus except while typing in a text field (spec 015).
- §16.1: default hotkey `Alt+T`, migrated once from the old default.

## 0.2.11 — 2026-09-29

- §16.4: default Bone and default side filter for a new item (spec 014).

## 0.2.10 — 2026-09-29

- §2.4 (new): trade search link planned after MVP (spec 013); in-game search integration dropped.
- Housekeeping: no changelog entries were recorded for 0.2.3 and 0.2.4 (0.2.4 is the first version
  in the repository history); the identifier U-010 is not assigned.

## 0.2.9 — 2026-09-29

Maintainer feedback: hotkey after clicking the overlay, clearer and roomier UI.

Changes:

- §3.1: pressed while the overlay has focus, the hotkey hides it first so the game gets focus back,
  then copies the hovered item.
- §16.4: three-column layout; free prefix/suffix slots; item preview with the picked modifier;
  Omens unusable on the item are hidden.

## 0.2.8 — 2026-09-29

Maintainer decisions: in-app updates, release notes, compatible currencies only.

Changes:

- §3.5 (new): app update check against the public releases repository; download only on click.
- §6.1: the update check is the only runtime network access.
- §16.4: only currencies usable on the item are listed; the incompatible/legacy toggle is removed.
- §16.7, §16.8 (new): `checkForUpdates` setting; release-notes dialog after an update.

## 0.2.7 — 2026-09-29

Maintainer feedback: too much text on first sight.

Changes:

- §14.7: an `unknown` exact item check is no longer displayed next to the base pool; the base pool
  note says the item's current modifiers are not taken into account. Other statuses still show.
- §16.4: the parser confidence badge appears only when parsing was not full.
- App icon: the title bar's green diamond, generated in code, for tray, window and executable.

## 0.2.6 — 2026-09-27

Maintainer decision: one hotkey press copies and shows the hovered item.

Changes:

- §3.1: auto-copy exception. The hotkey sends `Ctrl+Alt+C` to the game once per press, can be
  turned off in settings, and is the only input the app ever sends.
- §1.3, §16.1, §16.7 updated accordingly.

## 0.2.5 — 2026-09-27

Maintainer feedback after the first Windows test.

Changes:

- Added the base Desecration pool (§14.7): shown for compatible Bone/Omen selections even when the exact
  item state cannot be determined; clearly labelled as not final. The exact item check stays fail-closed.
- §16.1: the hotkey re-reads the clipboard while the overlay is visible and switches to a newly copied
  item instead of hiding; explicit read button and `Escape` to hide.
- §16.3: dark Abyss-inspired theme instead of a neutral one.

## 0.2.2 — 2026-09-26

Data-truth / anti-hallucination hardening.

Changes:

- Made zero invented PoE2 game data a normative project invariant.
- Added explicit fail-closed behavior for missing, contradictory or unresolvable game data.
- Prohibited LLM/model-memory-generated production catalogs, guessed IDs/names and silent source conflict resolution.
- Added provenance/evidence contracts for normalized records, curated rules and anomaly overrides.
- Added `sourceRefs` to reference normalized base/modifier schemas.
- Strengthened `data:update` with snapshot hashing, provenance attachment, anti-hallucination validation and conflict reporting.
- Added build gates preventing unproven currency/Omen/rule entries and test-only entities from reaching production data packs.

## 0.2.0 — 2026-09-26

Autonomous research/update pass after MVP-scope decision.

Changes:

- MVP languages reduced to EN + PL; DE deferred while locale/provider architecture remains extensible.
- MVP clipboard parser reduced to EN; locale-adapter registry retained for future languages.
- Game terminology is EN-only in MVP, including PL UI.
- RePoE upstream version stamp observed as `4.5.5.2`.
- Modifier normalization expanded with `modTypeId`, `sourceKind`, `lichPool`, and `specialPools`.
- Defined build-time Lich classification with curated anomaly overrides + canonical-name semantics + tag auditing.
- Defined special Otherworldly eligibility for `breach_desecration`, separate from ordinary base spawn-weight evaluation.
- Defined jewel-exclusive classification.
- Clarified effective tags / `adds_tags` handling.
- Added data-update validation gates and semantic-diff requirements.
- Clarified item-level eligibility vs Ancient/Mark minimum-modifier-level floors.
- Updated Claude Code spec-generation and Definition-of-Done requirements to match EN/PL MVP.

## 0.1.0 — 2026-09-26

Initial master source of truth created.

Key decisions captured:

- Electron/React/TypeScript architecture.
- clipboard-only runtime boundary.
- EN/PL/DE UI.
- EN/DE official game terminology with PL->EN fallback.
- offline versioned RePoE-backed data pack.
- branch-aware pool engine.
- separation of Lich mod natural eligibility from Lich Omen compatibility.
- Altered Collarbone/Otherworldly support.
- Putrefaction as separate mode.
- Mark of the Abyssal Lord support with blocked unknown edge cases.
- no probability claims.
- manual validation matrix.
- Claude Code spec decomposition plan.
