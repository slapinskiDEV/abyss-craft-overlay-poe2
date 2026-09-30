# 008 — Packaging and data update

**SoT refs:** §3.3, §4.1, §6.5–6.7, §7.9, §18.3 #28, §19.4, §22.2, §24

## Goal

Produce an unsigned Windows build containing only a real, validated data pack, through a
reproducible data-update workflow and a release pipeline that cannot pass on skipped real-data
tests.

## In scope

- electron-vite build, electron-builder Windows targets, bundled pack.
- npm scripts for data update, validation, release verification, packaging.
- Release checklist.

## Out of scope

- Code signing, auto-update, store distribution (SoT §19.4, §6.7); macOS/Linux packages.

## Interfaces / contracts

### npm scripts

| Script | Action |
|---|---|
| `dev` | electron-vite dev |
| `build` | typecheck + electron-vite build |
| `typecheck` | `tsc --noEmit` (node + web configs) |
| `test` | vitest run (real-data suites may skip) |
| `data:update` | SoT §6.7: fetch -> hash/archive -> normalize -> provenance -> gates -> manifest -> domain fixtures -> semantic diff + conflicts |
| `data:normalize` / `data:validate` / `data:diff` | individual steps |
| `i18n:validate` | translation parity |
| `verify:release` | 007 gate: validated production pack + `REQUIRE_REAL_DATA=1` tests + i18n + traceability |
| `package:win` | `verify:release && build && electron-builder --win nsis portable` |

`package:win` has no flag to bypass `verify:release`. The NSIS target needs Windows (or Wine on
Linux); the portable target also builds on Linux without Wine. `package:scan` checks the bundled
code and pack for TEST_ONLY data before electron-builder runs. `data:update` is the only script with
network access; it writes a new snapshot directory that is then committed (007), so the release
gate runs offline against pinned, hashed inputs.

### Bundled pack

- Generated: `src/data/normalized/pack/*.json`, `src/data/manifest/manifest.json`
  (`validated`, `dataPackId`, `repoeObservedVersion`, sources).
- `extraResources`: pack -> `data-pack`. `tests/` and synthetic fixtures are excluded from
  `files`; the build fails if the pack contains `TEST_ONLY` (002 gate re-run on the output).
- Runtime integrity check in 001.

### electron-builder

`appId` provisional and brand-neutral (SoT §1.1); `win.target` nsis + portable, x64; `asar: true`;
`publish: null`; notice file with the GGG notice (SoT §3.3).

### Versioning / freshness

App semver; data version = manifest `targetGameVersion` + `repoeObservedVersion` +
`generatedAt` + `dataPackId`, shown in header and About. `data-source/manifest/target.json` can
mark a pack stale -> SoT §22.2 banner.

### Release checklist (`docs/RELEASE_CHECKLIST.md`, created at implementation)

1. `npm run verify:release` green (no skips).
2. Semantic diff + audit report reviewed; golden files approved.
3. Manual smoke on Windows 10/11 (SoT §18.6).
4. GGG notice and manifest visible.
5. SoT §24 checklist signed off.
6. Changelog updated; SoT changelog updated if a decision changed.

## Algorithm/design choice

Reference design.

## Acceptance criteria

1. `package:win` cannot produce an artifact without a validated real pack and a skip-free real
   test run (SoT §18.3 #28, §19.4).
2. Packaged app runs offline with the bundled pack only.
3. Tampered/missing pack fails loudly at runtime (001).
4. No TEST_ONLY data in the artifact.

## Tests

Resource path resolution; pack integrity; release-gate self-test (007); artifact scan for
`TEST_ONLY`.

## Dependencies

001, 002, 007.

## Unresolved items

None specific.
