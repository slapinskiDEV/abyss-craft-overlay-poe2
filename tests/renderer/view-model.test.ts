import { describe, expect, it } from 'vitest';
import { evaluateDesecration } from '../../src/domain';
import { createGameTermProvider } from '../../src/i18n/game/providers/registry';
import { buildDebugReport } from '../../src/renderer/view-model/debug-report';
import { availableCategories, buildRows, DEFAULT_FILTERS, defaultPoolSource, poolBranches, poolHeadingKey, weakestCompleteness } from '../../src/renderer/view-model/rows';
import { INITIAL_WORKSPACE, workspaceReducer } from '../../src/renderer/view-model/workspace';
import { ENGINE_PACK as data, affix, parsed } from '../fixtures/data/test-only-engine-pack';

const game = createGameTermProvider(data, 'en');
const full = parsed('armour', ['P1', 'P2', 'P3', 'S1', 'S2', 'S3'].map((s) => affix(`TEST_ONLY_MOD_ARMOUR_${s}`)));
const fullEval = evaluateDesecration({ item: full, currency: 'TEST_ONLY_BONE_ARMOUR_PLAIN', activeOmens: [], data, parserConfidence: 'full' });
const openEval = evaluateDesecration({ item: parsed('armour', [affix('TEST_ONLY_MOD_ARMOUR_P1')]), currency: 'TEST_ONLY_BONE_ARMOUR_PLAIN', activeOmens: ['TEST_ONLY_OMEN_FORCE_SUFFIX'], data, parserConfidence: 'full' });

describe('rows view-model', () => {
  it('shows branch coverage k/n in the union view, never a probability', () => {
    const rows = buildRows(fullEval, 'union', 'eligible', DEFAULT_FILTERS, game);
    const p1 = rows.find((r) => r.modifierId === 'TEST_ONLY_MOD_ARMOUR_P1');
    // P1 becomes eligible only in the branch that removes it: 1 of 6 branches.
    expect(p1?.coverage).toEqual({ count: 1, of: 6 });
  });

  it('changes with the selected branch', () => {
    const [first, second] = fullEval.branches;
    const a = buildRows(fullEval, first?.id ?? '', 'eligible', DEFAULT_FILTERS, game).map((r) => r.modifierId);
    const b = buildRows(fullEval, second?.id ?? '', 'eligible', DEFAULT_FILTERS, game).map((r) => r.modifierId);
    expect(a).not.toEqual(b);
  });

  it('filters by side, category, level and text', () => {
    const rows = buildRows(openEval, 'union', 'eligible', { ...DEFAULT_FILTERS, categories: ['exclusive'] }, game);
    expect(rows.map((r) => r.modifierId)).toEqual(['TEST_ONLY_MOD_ARMOUR_EXCL_LICH_A_S']);
    expect(buildRows(openEval, 'union', 'eligible', { ...DEFAULT_FILTERS, minLevel: 66 }, game)).toEqual([]);
    expect(buildRows(openEval, 'union', 'eligible', { ...DEFAULT_FILTERS, text: 'armour_s2' }, game).map((r) => r.modifierId)).toEqual(['TEST_ONLY_MOD_ARMOUR_S2']);
  });

  it('hides base-ineligible blocked rows unless searched or requested', () => {
    const hidden = buildRows(openEval, 'union', 'blocked', DEFAULT_FILTERS, game).map((r) => r.modifierId);
    expect(hidden).not.toContain('TEST_ONLY_MOD_WEAPON_S1');
    expect(buildRows(openEval, 'union', 'blocked', { ...DEFAULT_FILTERS, text: 'weapon_s1' }, game).map((r) => r.modifierId)).toContain('TEST_ONLY_MOD_WEAPON_S1');
  });

  it('offers only categories present in the data', () => {
    expect(availableCategories(openEval)).toEqual(['regular', 'exclusive', 'lich:amanamu', 'lich:kurgal', 'special:otherworldly']);
    expect(availableCategories(null)).toEqual([]);
  });

  it('uses the "Eligible modifier pool" heading only for final pools (SoT §9.4, §18.3 #24)', () => {
    expect(poolHeadingKey('final')).toBe('workspace:eligiblePoolHeading');
    expect(poolHeadingKey('base_eligibility_only')).toBe('workspace:baseEligibilityHeading');
    expect(poolHeadingKey('unknown')).toBeNull();
    expect(weakestCompleteness([])).toBe('unknown');
  });
});

describe('workspace reducer', () => {
  it('drops selections that are no longer selectable after a new item', () => {
    let s = workspaceReducer(INITIAL_WORKSPACE, { type: 'bone', boneId: 'TEST_ONLY_BONE_ARMOUR_PLAIN' });
    s = workspaceReducer(s, { type: 'toggleOmen', omenId: 'TEST_ONLY_OMEN_FORCE_SUFFIX' });
    s = workspaceReducer(s, { type: 'keepSelectable', boneIds: new Set(), omenIds: new Set(['TEST_ONLY_OMEN_FORCE_SUFFIX']) });
    expect(s).toMatchObject({ boneId: null, omenIds: ['TEST_ONLY_OMEN_FORCE_SUFFIX'] });
    expect(workspaceReducer(s, { type: 'toggleOmen', omenId: 'TEST_ONLY_OMEN_FORCE_SUFFIX' }).omenIds).toEqual([]);
  });
});

describe('workspace reducer (spec 009)', () => {
  it('restores the Bone the user chose for the same target group, never an automatic first pick', () => {
    let s = workspaceReducer(INITIAL_WORKSPACE, { type: 'bone', boneId: 'TEST_ONLY_BONE_WEAPON_PLAIN', targetGroup: 'weapon_or_quiver' });
    s = workspaceReducer(s, { type: 'clipboard', text: 'TEST_ONLY armour' });
    s = workspaceReducer(s, { type: 'keepSelectable', boneIds: new Set(['TEST_ONLY_BONE_ARMOUR_PLAIN']), omenIds: new Set(), targetGroup: 'armour' });
    expect(s.boneId).toBeNull();
    s = workspaceReducer(s, { type: 'clipboard', text: 'TEST_ONLY weapon' });
    s = workspaceReducer(s, { type: 'keepSelectable', boneIds: new Set(['TEST_ONLY_BONE_WEAPON_PLAIN']), omenIds: new Set(), targetGroup: 'weapon_or_quiver' });
    expect(s.boneId).toBe('TEST_ONLY_BONE_WEAPON_PLAIN');
  });

  it('resets the pool source and branch for a new item', () => {
    let s = workspaceReducer(INITIAL_WORKSPACE, { type: 'poolSource', source: 'base' });
    s = workspaceReducer(s, { type: 'branch', branchId: 'union' });
    s = workspaceReducer(s, { type: 'clipboard', text: 'TEST_ONLY next item' });
    expect(s).toMatchObject({ poolSource: null, selectedBranchId: null, rawText: 'TEST_ONLY next item' });
  });

  it('picks the item pool by default and the base pool when the item pool is unknown', () => {
    expect(defaultPoolSource(openEval)).toBe('item');
    const unknown = evaluateDesecration({ item: { ...full, abyss: { ...full.abyss, existingDesecration: 'undetermined' } }, currency: 'TEST_ONLY_BONE_ARMOUR_PLAIN', activeOmens: [], data, parserConfidence: 'full' });
    expect(defaultPoolSource(unknown)).toBe('base');
    expect(poolHeadingKey('base_eligibility_only', 'base')).toBe('workspace:basePoolHeading');
    const rows = buildRows(poolBranches(unknown, 'base'), 'union', 'eligible', DEFAULT_FILTERS, game);
    expect(rows.some((r) => r.modifierId === 'TEST_ONLY_MOD_ARMOUR_P1')).toBe(true);
  });
});

describe('debug report (SoT §15.3)', () => {
  const base = { appInfo: null, parse: null, evaluation: openEval, boneId: 'TEST_ONLY_BONE_ARMOUR_PLAIN', omenIds: [], rawText: 'TEST_ONLY raw clipboard', gameTermDiagnostics: [] };
  it('excludes raw clipboard text unless explicitly included', () => {
    expect(buildDebugReport({ ...base, includeRawText: false })).not.toContain('TEST_ONLY raw clipboard');
    expect(buildDebugReport({ ...base, includeRawText: true })).toContain('TEST_ONLY raw clipboard');
  });
  it('carries the data manifest and reason codes', () => {
    const report = JSON.parse(buildDebugReport({ ...base, includeRawText: false })) as { dataManifest: { dataPackId: string }; evaluation: { status: string } };
    expect(report.dataManifest.dataPackId).toBe('TEST_ONLY_PACK');
    expect(report.evaluation.status).toBe('valid');
  });
});
