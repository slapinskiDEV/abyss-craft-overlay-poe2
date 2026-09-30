// Data-build validation gates (SoT §7.9, spec 002). Returns every failure; the manifest is marked
// validated only when this list is empty.
import { isOrdinarilySpawnable } from '../../domain/modifiers/spawn-weight';
import type { DataPack } from '../normalized/types';
import { computeDataPackId } from './build-pack';
import type { RegistryIssue } from './rules';

// SoT §13.3 / §21 facts checked against the data (they are SoT statements, not entity catalogs).
const NO_EXCLUSIVE_PREFIX_CLASSES = ['Body Armour', 'Helmet', 'Gloves', 'Boots', 'Sceptre'];
const NO_EXCLUSIVE_SUFFIX_CLASSES = ['Sceptre'];
const ORNATE_PLATE = { id: 'Metadata/Items/Armours/BodyArmours/FourBodyStr6Endgame', itemClassId: 'Body Armour', tags: ['str_armour', 'body_armour', 'armour'] };

export function validatePack(pack: DataPack, buildIssues: readonly RegistryIssue[] = []): RegistryIssue[] {
  const issues: RegistryIssue[] = [...buildIssues];
  const { manifest, ...content } = pack;

  if (computeDataPackId(content) !== manifest.dataPackId) issues.push({ code: 'DATA_PACK_ID_MISMATCH', detail: manifest.dataPackId });

  const exclusive = pack.modifiers.filter((m) => m.sourceKind === 'desecrated_exclusive');
  if (exclusive.length === 0) issues.push({ code: 'DESECRATED_DOMAIN_MISSING', detail: 'no desecrated_exclusive rows' });
  if (!pack.modifiers.some((m) => m.specialPools.includes('otherworldly'))) issues.push({ code: 'OTHERWORLDLY_MISSING', detail: 'no breach_desecration-gated rows' });

  for (const m of pack.modifiers) {
    if (!m.modTypeId || m.groups.length === 0 || m.stats.length === 0 || !m.tierFamilyId) {
      issues.push({ code: 'MODIFIER_IDENTITY_INCOMPLETE', detail: m.id });
    }
  }

  const records = [...pack.baseItems, ...pack.modifiers, ...pack.bones, ...pack.omens, ...pack.otherCurrencies, ...pack.itemClasses];
  for (const r of records) {
    if (r.sourceRefs.length === 0) issues.push({ code: 'SOURCE_REFS_MISSING', detail: r.id });
    for (const ref of r.sourceRefs) if (!pack.provenance[ref.split('#')[0] ?? '']) issues.push({ code: 'SOURCE_REF_UNKNOWN', detail: `${r.id}: ${ref}` });
  }

  // SoT §0.2 rule 9: no synthetic entity may reach the production pack.
  const serialized = JSON.stringify(content);
  if (/TEST_ONLY/i.test(serialized)) issues.push({ code: 'TEST_ONLY_IN_PACK', detail: 'TEST_ONLY marker found in pack content' });

  const classIds = new Set(pack.itemClasses.map((c) => c.id));
  for (const l of pack.affixLimits) if (!classIds.has(l.itemClassId)) issues.push({ code: 'AFFIX_LIMIT_CLASS_UNKNOWN', detail: l.itemClassId });

  const released = pack.baseItems.filter((b) => b.releaseState === 'released');
  const spawnable = (cls: string, side: 'prefix' | 'suffix') =>
    exclusive.filter((m) => m.side === side && released.some((b) => b.itemClassId === cls && isOrdinarilySpawnable(m.spawnWeights, new Set(b.tags))));
  for (const cls of NO_EXCLUSIVE_PREFIX_CLASSES) {
    const hits = spawnable(cls, 'prefix');
    if (hits.length > 0) issues.push({ code: 'SOT_INVARIANT_MISMATCH', detail: `${cls} has exclusive prefixes: ${hits.map((m) => m.id).join(', ')}` });
  }
  for (const cls of NO_EXCLUSIVE_SUFFIX_CLASSES) {
    const hits = spawnable(cls, 'suffix');
    if (hits.length > 0) issues.push({ code: 'SOT_INVARIANT_MISMATCH', detail: `${cls} has exclusive suffixes: ${hits.map((m) => m.id).join(', ')}` });
  }
  const plate = pack.baseItems.find((b) => b.id === ORNATE_PLATE.id);
  if (!plate || plate.itemClassId !== ORNATE_PLATE.itemClassId || !ORNATE_PLATE.tags.every((t) => plate.tags.includes(t))) {
    issues.push({ code: 'SOT_INVARIANT_MISMATCH', detail: 'SoT §21 Ornate Plate facts not found' });
  }

  return issues;
}
