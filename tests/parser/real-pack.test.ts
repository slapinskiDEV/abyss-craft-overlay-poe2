// Real-pack parser check. The clipboard text is generated from pack data (the SoT §21 base and pack
// translation templates) — nothing is typed from memory — so it tests matching against real
// RePoE templates, not the real clipboard format (that needs verbatim fixtures, SoT §19.1).
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import type { DataPack, ModifierDefinition } from '../../src/data/normalized/types';
import { isOrdinarilySpawnable } from '../../src/domain/modifiers/spawn-weight';
import { createClipboardParser } from '../../src/parser/registry';
import { describeRealData } from '../support/real-data';

const ORNATE_PLATE_ID = 'Metadata/Items/Armours/BodyArmours/FourBodyStr6Endgame'; // SoT §21

describeRealData('parser against the real pack', () => {
  const pack = JSON.parse(readFileSync('src/data/normalized/pack/pack.json', 'utf8')) as DataPack;
  const plate = pack.baseItems.find((b) => b.id === ORNATE_PLATE_ID);
  const className = pack.itemClasses.find((c) => c.id === plate?.itemClassId)?.canonicalNameEn;
  const strip = (t: string) => t.replace(/\[([^\]|]*)\|([^\]]*)\]/g, '$2').replace(/\[([^\]]*)\]/g, '$1');

  // Single-stat regular mods on the plate whose template renders the raw value unchanged.
  const renderable = (m: ModifierDefinition, side: 'prefix' | 'suffix') => {
    if (m.side !== side || m.sourceKind !== 'regular' || m.stats.length !== 1 || !plate) return undefined;
    if (!isOrdinarilySpawnable(m.spawnWeights, new Set(plate.tags))) return undefined;
    const stat = m.stats[0];
    const entry = pack.statTranslationsEn.find((e) => e.statIds.length === 1 && e.statIds[0] === stat?.id);
    const variant = entry?.variants.find((v) => (v.indexHandlers[0] ?? []).length === 0 && (v.conditions[0]?.min ?? -Infinity) <= (stat?.max ?? 0) && (v.conditions[0]?.max ?? Infinity) >= (stat?.max ?? 0) && !v.template.includes('\n'));
    return stat && variant && variant.template.includes('{0}') ? { mod: m, line: strip(variant.template).replace(/\{0\}/, String(stat.max)) } : undefined;
  };
  const prefix = pack.modifiers.map((m) => renderable(m, 'prefix')).find((x) => x !== undefined);
  const suffix = pack.modifiers.map((m) => renderable(m, 'suffix')).find((x) => x !== undefined);

  it('resolves the SoT §21 base and matches pack-rendered affixes', () => {
    expect(plate && className && prefix && suffix).toBeTruthy();
    const text = [
      `Item Class: ${className}`,
      'Rarity: Rare',
      'TEST_ONLY Generated Name',
      plate?.canonicalNameEn,
      '--------',
      'Item Level: 82',
      '--------',
      `{ Prefix Modifier "${prefix?.mod.canonicalNameEn}" }`,
      prefix?.line,
      `{ Suffix Modifier "${suffix?.mod.canonicalNameEn}" }`,
      suffix?.line,
    ].join('\n');
    const result = createClipboardParser(pack).parse(text, 'auto');
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    expect(result.item.baseItemId).toBe(ORNATE_PLATE_ID);
    expect(result.item.itemClassId).toBe('Body Armour');
    expect(result.item.prefixes[0]?.candidateModifierIds).toContain(prefix?.mod.id);
    expect(result.item.suffixes[0]?.candidateModifierIds).toContain(suffix?.mod.id);
  });
});
