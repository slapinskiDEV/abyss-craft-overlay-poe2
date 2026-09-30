// Real-data checks against the committed RePoE snapshot (SoT §6.2, §13.3, §21).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { normalizeBases } from '../../src/data/adapters/normalize-bases';
import { normalizeMods } from '../../src/data/adapters/normalize-mods';
import type { RawBaseItem, RawMod } from '../../src/data/adapters/raw-types';
import { isOrdinarilySpawnable } from '../../src/domain/modifiers/spawn-weight';
import { describeRealData } from '../support/real-data';

describeRealData('real RePoE snapshot', (dir) => {
  const read = <T>(file: string): T => JSON.parse(readFileSync(join(dir, file), 'utf8')) as T;
  const rawMods = read<Record<string, RawMod>>('mods.min.json');
  const rawBases = read<Record<string, RawBaseItem>>('base_items.min.json');

  const bases = normalizeBases(rawBases, new Set(['Body Armour', 'Helmet', 'Gloves', 'Boots', 'Sceptre', 'Jewel']), 'snapshot:base_items');
  const released = bases.filter((b) => b.releaseState === 'released');
  const { modifiers } = normalizeMods({
    mods: rawMods,
    regularDomains: ['item', 'misc'],
    jewelBaseTagSets: released.filter((b) => b.itemClassId === 'Jewel').map((b) => new Set(b.tags)),
    lichOverrides: new Map(),
    sourceFileRef: 'snapshot:mods',
  });

  it('does not lose desecrated-domain prefix/suffix rows (SoT §6.2 mods_by_base limitation)', () => {
    const rawDesecrated = Object.entries(rawMods).filter(
      ([, m]) => m.domain === 'desecrated' && (m.generation_type === 'prefix' || m.generation_type === 'suffix'),
    );
    const normalized = new Set(modifiers.filter((m) => m.sourceKind === 'desecrated_exclusive').map((m) => m.id));
    expect(rawDesecrated.length).toBeGreaterThan(0);
    expect(rawDesecrated.filter(([id]) => !normalized.has(id))).toEqual([]);
  });

  it('holds the SoT §13.3 exclusive-prefix invariants', () => {
    const exclusive = modifiers.filter((m) => m.sourceKind === 'desecrated_exclusive');
    const spawnableOn = (itemClassId: string, side: 'prefix' | 'suffix') =>
      exclusive.filter((m) => m.side === side && released.some((b) => b.itemClassId === itemClassId && isOrdinarilySpawnable(m.spawnWeights, new Set(b.tags))));
    for (const cls of ['Body Armour', 'Helmet', 'Gloves', 'Boots', 'Sceptre']) expect(spawnableOn(cls, 'prefix'), cls).toEqual([]);
    expect(spawnableOn('Sceptre', 'suffix')).toEqual([]);
  });

  it('contains the SoT §21 Ornate Plate facts', () => {
    const plate = bases.find((b) => b.id === 'Metadata/Items/Armours/BodyArmours/FourBodyStr6Endgame');
    expect(plate).toMatchObject({ canonicalNameEn: 'Ornate Plate', itemClassId: 'Body Armour' });
    expect(plate?.tags).toEqual(expect.arrayContaining(['str_armour', 'body_armour', 'armour']));
  });

  it('gives every modifier a stable side, type, groups and provenance (SoT §7.9)', () => {
    const broken = modifiers.filter((m) => !m.modTypeId || m.groups.length === 0 || m.sourceRefs.length === 0);
    expect(broken.map((m) => m.id)).toEqual([]);
  });
});
