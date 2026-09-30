// SoT §18.3 / §21 on the real pack. Entities are resolved from the pack by SoT-given names and
// data-driven base selection; ParsedItems are built directly (a confirmed parser's output), so
// these tests exercise real modifier data, not the unconfirmed clipboard grammar.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { appStableKey } from '../../src/data/adapters/rules';
import type { BaseItemDefinition, DataPack } from '../../src/data/normalized/types';
import { boneOptions, evaluateDesecration } from '../../src/domain';
import type { ParsedItem } from '../../src/parser/common/types';
import { describeRealData } from '../support/real-data';

describeRealData('SoT §18.3 / §21 on the real pack', () => {
  const data = JSON.parse(readFileSync('src/data/normalized/pack/pack.json', 'utf8')) as DataPack;
  const id = (sotName: string) => appStableKey(sotName); // SoT §10.2 / §11.1 names
  const releasedOf = (cls: string) => data.baseItems.find((b) => b.itemClassId === cls && b.releaseState === 'released');
  const clean = (b: BaseItemDefinition | undefined, itemLevel: number): ParsedItem => {
    if (!b) throw new Error('base missing from pack');
    return {
      parserLocale: 'en', copyMode: 'advanced', rawText: '', rarity: 'rare', baseTypeText: b.canonicalNameEn, baseItemId: b.id,
      itemClassId: b.itemClassId, itemLevel, baseTags: b.tags, corrupted: false, mirrored: false, unidentified: false,
      prefixes: [], suffixes: [], unknownAffixes: [], fracturedState: 'determined', isTimeLostJewel: false,
      abyss: { hasUnrevealedDesecratedModifier: false, hasRevealedDesecratedModifier: false, hasMarkOfAbyssalLord: false, isSpecialMultiDesecrationItem: false, existingDesecration: 'absent', markState: 'absent' },
    };
  };
  const run = (item: ParsedItem, currency: string, omens: string[] = []) =>
    evaluateDesecration({ item, currency: id(currency), activeOmens: omens.map(id), data, parserConfidence: 'full' });

  const plate = clean(data.baseItems.find((b) => b.id === 'Metadata/Items/Armours/BodyArmours/FourBodyStr6Endgame'), 82); // SoT §21

  it('§21.1 / #1 Ornate Plate + Preserved Rib is valid with a final pool', () => {
    const e = run(plate, 'Preserved Rib');
    expect(e.status).toBe('valid');
    expect(e.poolCompleteness).toBe('final');
  });

  it('§21.2 no natural exclusive Desecrated prefixes for Body Armour', () => {
    const e = run(plate, 'Preserved Rib', ['Omen of Sinistral Necromancy']);
    expect(e.branches[0]?.eligible.filter((c) => c.sourceKind === 'desecrated_exclusive')).toEqual([]);
  });

  it('§21.3 / §21.7 suffix pool has regular and exclusive candidates, Lich ones naturally included', () => {
    const e = run(plate, 'Preserved Rib', ['Omen of Dextral Necromancy']);
    const s = e.branches[0]?.poolSummary;
    expect(e.branches.map((b) => b.side)).toEqual(['suffix']);
    expect(s?.regular).toBeGreaterThan(0);
    expect(s?.exclusive).toBeGreaterThan(0);
    expect((s?.amanamu ?? 0) + (s?.ulaman ?? 0) + (s?.kurgal ?? 0)).toBeGreaterThan(0);
  });

  it('§21.4 / #2 Lich Omens cannot be used with a Rib', () => {
    for (const omen of ['Omen of the Liege', 'Omen of the Sovereign', 'Omen of the Blackblooded']) {
      expect(run(plate, 'Preserved Rib', [omen]).reasons.map((r) => r.code)).toContain('LICH_OMEN_INCOMPATIBLE_WITH_BONE');
    }
  });

  it('#5 Bow ilvl 82 + Preserved Jawbone + Liege + Sinistral -> only Amanamu prefixes', () => {
    const e = run(clean(releasedOf('Bow'), 82), 'Preserved Jawbone', ['Omen of the Liege', 'Omen of Sinistral Necromancy']);
    const eligible = e.branches[0]?.eligible ?? [];
    expect(eligible.length).toBeGreaterThan(0);
    expect(eligible.every((c) => c.lichPool === 'amanamu' && c.side === 'prefix')).toBe(true);
  });

  it('#7 Weapon ilvl 64 + Gnawed Jawbone + Liege -> valid with warning, forced pool empty', () => {
    const e = run(clean(releasedOf('Bow'), 64), 'Gnawed Jawbone', ['Omen of the Liege']);
    expect(e.status).toBe('valid_with_warning');
    expect(e.reasons.map((r) => r.code)).toContain('FORCED_LICH_POOL_EMPTY');
  });

  it('#10 / #11 Altered Collarbone: Lich Omen invalid, Otherworldly suffixes eligible', () => {
    const ringItem = clean(releasedOf('Ring'), 82);
    expect(run(ringItem, 'Altered Collarbone', ['Omen of the Liege']).status).toBe('invalid');
    const e = run(ringItem, 'Altered Collarbone', ['Omen of Dextral Necromancy']);
    expect(e.branches[0]?.poolSummary.otherworldly).toBeGreaterThan(0);
    const ordinary = run(ringItem, 'Preserved Collarbone', ['Omen of Dextral Necromancy']);
    expect(ordinary.branches[0]?.poolSummary.otherworldly).toBe(0);
  });

  it('#18 Putrefaction keeps regular sources only', () => {
    const e = run(plate, 'Preserved Rib', ['Omen of Putrefaction']);
    expect(e.putrefaction?.maxUnrevealed).toBe(6);
    expect(e.branches.every((b) => b.eligible.every((c) => c.sourceKind === 'regular'))).toBe(true);
  });

  it('offers only Rib Bones for the plate, from pack data', () => {
    const selectable = boneOptions(plate, data, { includeLegacy: false }).filter((o) => o.selectable).map((o) => o.boneId);
    // Gnawed Rib is excluded because the plate is item level 82 (> 64).
    expect(selectable.sort()).toEqual(['ancient_rib', 'preserved_rib']);
  });
});
