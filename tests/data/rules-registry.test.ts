import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { appStableKey, checkEvidence, loadRuleRegistry, matchRows, resolveByName } from '../../src/data/adapters/rules';
import type { RawBaseItem, RawMod } from '../../src/data/adapters/raw-types';
import { describeRealData } from '../support/real-data';

const registry = loadRuleRegistry(join('data-source', 'rules'));

describe('rule registry structure', () => {
  it('derives app-stable keys from SoT names (SoT §5.5 examples)', () => {
    expect(appStableKey('Preserved Rib')).toBe('preserved_rib');
    expect(appStableKey('Omen of the Liege')).toBe('omen_of_the_liege');
  });

  it('restricts Lich force Omens to Jawbone and ordinary Collarbone (SoT §11.3)', () => {
    const lich = registry.omens.filter((o) => o.effect.kind === 'force_lich');
    expect(lich).toHaveLength(3);
    for (const omen of lich) expect(omen.compatibleBoneFamilies).toEqual(['jawbone', 'collarbone']);
  });

  it('keeps Preserved Vertebrae marked legacy (SoT §2.2)', () => {
    expect(registry.bones.filter((b) => b.releaseState === 'drop_disabled_legacy').map((b) => b.family)).toEqual(['vertebrae']);
  });

  it('only unlocks Otherworldly on the Altered Collarbone (SoT §10.4)', () => {
    expect(registry.bones.filter((b) => b.unlocksSpecialPools.includes('otherworldly')).map((b) => b.family)).toEqual(['altered_collarbone']);
  });
});

describeRealData('rule registry against the real snapshot', (dir) => {
  const snapshot = JSON.parse(readFileSync(join(dir, 'snapshot.json'), 'utf8')) as { files: Array<{ id: string }> };
  const bases = JSON.parse(readFileSync(join(dir, 'base_items.min.json'), 'utf8')) as Record<string, RawBaseItem>;
  const mods = JSON.parse(readFileSync(join(dir, 'mods.min.json'), 'utf8')) as Record<string, RawMod>;
  const uniques = JSON.parse(readFileSync(join(dir, 'uniques.min.json'), 'utf8')) as Record<string, { name: string }>;

  it('has evidence for every rule and every evidence ref resolves', () => {
    expect(checkEvidence(registry, new Set(snapshot.files.map((f) => f.id)))).toEqual([]);
  });

  it('resolves every Bone, Omen and referenced currency to exactly one record', () => {
    const names = [...registry.bones, ...registry.omens, ...registry.otherCurrencies].map((e) => e.lookupNameEn);
    const { resolved, issues } = resolveByName(names, bases);
    expect(issues).toEqual([]);
    expect(resolved).toHaveLength(names.length);
  });

  it('maps every target item class to released bases', () => {
    for (const t of registry.itemClassTargets) {
      expect(Object.values(bases).some((b) => b.item_class === t.itemClassId && b.release_state === 'released'), t.itemClassId).toBe(true);
    }
  });

  it('resolves the SoT §7.5 Lich override to exactly one desecrated row', () => {
    for (const o of registry.lichOverrides) expect(matchRows(o.match, mods), o.description).toHaveLength(1);
  });

  it('resolves the Mark of the Abyssal Lord to the expected rows (SoT §12.1)', () => {
    expect(matchRows(registry.abyssMark.match, mods)).toHaveLength(registry.abyssMark.expectedCount);
  });

  it('resolves every special item rule to at least one record', () => {
    for (const s of registry.specialItems) {
      const { uniqueNameEn, itemClassId, baseNamePrefix } = s.match;
      const hits = uniqueNameEn
        ? Object.values(uniques).filter((u) => u.name === uniqueNameEn)
        : Object.values(bases).filter((b) => b.item_class === itemClassId && baseNamePrefix !== undefined && b.name.startsWith(baseNamePrefix));
      expect(hits.length, JSON.stringify(s.match)).toBeGreaterThan(0);
    }
  });
});
