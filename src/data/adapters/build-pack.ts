// Deterministic data-pack build from snapshot inputs + rule registry (spec 002). Pure: all I/O is
// done by scripts/normalize-data.ts.
import { createHash } from 'node:crypto';
import type {
  BoneDefinition,
  DataPack,
  DataPackContent,
  EntityNameIndex,
  LichPool,
  OmenDefinition,
  OtherCurrencyDefinition,
  PoolCategoryId,
  PoolNameDefinition,
  ProvenanceRecord,
  SpecialItemDefinition,
  StatTranslationEntry,
} from '../normalized/types';
import { DATA_PACK_SCHEMA_VERSION } from '../normalized/types';
import { isOrdinarilySpawnable } from '../../domain/modifiers/spawn-weight';
import { normalizeBases } from './normalize-bases';
import { normalizeMods, type LichAuditEntry } from './normalize-mods';
import type { RawBaseItem, RawMod } from './raw-types';
import { checkEvidence, matchRows, resolveByName, type RegistryIssue, type ResolvedEntity, type RuleRegistry } from './rules';

export interface SnapshotInputs {
  record: {
    observedVersion: string;
    retrievedAt: string;
    files: Array<{ id: string; path: string; url: string; sha256: string }>;
  };
  mods: Record<string, RawMod>;
  bases: Record<string, RawBaseItem>;
  itemClasses: Record<string, { name: string }>;
  uniques: Record<string, { name: string; item_class: string }>;
  statDescriptions: Array<{
    ids: string[];
    English: Array<{ string: string; condition: Array<{ min?: number; max?: number; negated?: boolean }>; format: string[]; index_handlers: string[][] }>;
  }>;
}

export interface BuildTarget {
  targetGameVersion: string;
  stale: boolean;
}

export interface BuildReport {
  issues: RegistryIssue[];
  lichAudit: LichAuditEntry[];
  droppedModsByDomain: Record<string, number>;
  statsWithoutTranslation: string[];
  /** Desecrated rows no in-scope base can ordinarily roll and not Otherworldly-gated (special unique systems, U-005). */
  excludedUnreachableDesecrated: string[];
  resolvedEntities: ResolvedEntity[];
  resolvedOverrides: Array<{ description: string; modifierIds: string[] }>;
}

export const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex');

/** Hash over the pack content without the manifest, so it is stable and checkable at runtime. */
export const computeDataPackId = (content: DataPackContent): string => sha256(JSON.stringify(content));

const fileRef = (inputs: SnapshotInputs, path: string): string => {
  const file = inputs.record.files.find((f) => f.path === path);
  if (!file) throw new Error(`${path} missing from snapshot record`);
  return file.id;
};

const indexByName = (entries: Array<{ id: string; name: string }>): Record<string, string[]> => {
  const out: Record<string, string[]> = {};
  for (const { id, name } of entries) {
    if (!name) continue;
    (out[name] ??= []).push(id);
  }
  for (const ids of Object.values(out)) ids.sort();
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
};

export function buildPack(inputs: SnapshotInputs, registry: RuleRegistry, target: BuildTarget, rulesDigest: string): { pack: DataPack; report: BuildReport } {
  const issues: RegistryIssue[] = [];
  const modsRef = fileRef(inputs, 'mods.min.json');
  const basesRef = fileRef(inputs, 'base_items.min.json');
  const classesRef = fileRef(inputs, 'item_classes.min.json');

  // Provenance: snapshot files (VERIFIED_PRIMARY) + rule evidence records.
  const provenance: Record<string, ProvenanceRecord> = {};
  for (const f of inputs.record.files) {
    provenance[f.id] = {
      id: f.id,
      sourceName: 'RePoE PoE2',
      sourceUrl: f.url,
      observedVersion: inputs.record.observedVersion,
      retrievedAt: inputs.record.retrievedAt,
      sha256: f.sha256,
      evidenceLevel: 'VERIFIED_PRIMARY',
    };
  }
  for (const e of registry.evidence) provenance[e.id] = e;
  issues.push(...checkEvidence(registry, new Set(inputs.record.files.map((f) => f.id))));

  // Item classes / bases in scope = classes with an evidenced Bone target.
  const targetClassIds = new Set(registry.itemClassTargets.map((t) => t.itemClassId));
  const baseItems = normalizeBases(inputs.bases, targetClassIds, basesRef);
  const itemClasses = [...targetClassIds].sort().map((id) => ({
    id,
    canonicalNameEn: inputs.itemClasses[id]?.name ?? '',
    sourceRefs: [`${classesRef}#${id}`],
  }));
  for (const c of itemClasses) if (!c.canonicalNameEn) issues.push({ code: 'ITEM_CLASS_UNRESOLVED', detail: c.id });

  // Lich overrides resolved to exactly one row each.
  const lichOverrides = new Map<string, LichPool>();
  const resolvedOverrides = registry.lichOverrides.map((o) => {
    const modifierIds = matchRows(o.match, inputs.mods);
    const [only] = modifierIds;
    if (modifierIds.length === 1 && only) lichOverrides.set(only, o.lichPool);
    else issues.push({ code: 'LICH_OVERRIDE_UNRESOLVED', detail: `${o.description}: ${modifierIds.join(', ')}` });
    return { description: o.description, modifierIds };
  });

  const regularDomains = [...new Set(baseItems.map((b) => b.domain))].sort();
  const jewelBaseTagSets = baseItems
    .filter((b) => b.itemClassId === 'Jewel' && b.releaseState === 'released')
    .map((b) => new Set(b.tags));
  const normalized = normalizeMods({
    mods: inputs.mods,
    regularDomains,
    jewelBaseTagSets,
    lichOverrides,
    sourceFileRef: modsRef,
  });
  const baseTagSets = baseItems.map((b) => new Set(b.tags));
  const reachable = (m: (typeof normalized.modifiers)[number]): boolean =>
    m.sourceKind === 'regular' ||
    m.specialPools.includes('otherworldly') ||
    baseTagSets.some((tags) => isOrdinarilySpawnable(m.spawnWeights, tags));
  const modifiers = normalized.modifiers.filter(reachable);
  const excludedUnreachableDesecrated = normalized.modifiers.filter((m) => !reachable(m)).map((m) => m.id);
  const kept = new Set(modifiers.map((m) => m.id));
  const lichAudit = normalized.lichAudit.filter((a) => kept.has(a.modifierId));
  const droppedByDomain = normalized.droppedByDomain;

  // Entities named by the SoT, resolved in base_items.
  const allEntities = resolveByName(
    [...registry.bones, ...registry.omens, ...registry.otherCurrencies].map((e) => e.lookupNameEn),
    inputs.bases,
  );
  issues.push(...allEntities.issues);
  const entity = (name: string): ResolvedEntity | undefined => allEntities.resolved.find((r) => r.lookupNameEn === name);
  const constant = (key: string | undefined): number | undefined => (key ? registry.constants[key]?.value : undefined);

  const bones = registry.bones.flatMap((b): BoneDefinition[] => {
    const e = entity(b.lookupNameEn);
    if (!e) return [];
    const maxItemLevel = constant(b.maxItemLevelConstant);
    const minimumModifierLevel = constant(b.minimumModifierLevelConstant);
    return [{
      id: e.id,
      gameMetadataId: e.gameMetadataId,
      canonicalNameEn: e.canonicalNameEn,
      family: b.family,
      tier: b.tier,
      targetGroup: b.targetGroup,
      ...(maxItemLevel !== undefined ? { maxItemLevel } : {}),
      ...(minimumModifierLevel !== undefined ? { minimumModifierLevel } : {}),
      unlocksSpecialPools: b.unlocksSpecialPools,
      releaseState: b.releaseState,
      evidence: b.evidence,
      sourceRefs: [`${basesRef}#${e.gameMetadataId}`],
    }];
  });
  const omens = registry.omens.flatMap((o): OmenDefinition[] => {
    const e = entity(o.lookupNameEn);
    return e
      ? [{ id: e.id, gameMetadataId: e.gameMetadataId, canonicalNameEn: e.canonicalNameEn, phase: o.phase, effect: o.effect, compatibleBoneFamilies: o.compatibleBoneFamilies, evidence: o.evidence, sourceRefs: [`${basesRef}#${e.gameMetadataId}`] }]
      : [];
  });
  const otherCurrencies = registry.otherCurrencies.flatMap((c): OtherCurrencyDefinition[] => {
    const e = entity(c.lookupNameEn);
    return e
      ? [{ id: e.id, gameMetadataId: e.gameMetadataId, canonicalNameEn: e.canonicalNameEn, role: c.role, evidence: c.evidence, sourceRefs: [`${basesRef}#${e.gameMetadataId}`] }]
      : [];
  });

  const abyssMarkModifierIds = matchRows(registry.abyssMark.match, inputs.mods);
  if (abyssMarkModifierIds.length !== registry.abyssMark.expectedCount) {
    issues.push({ code: 'ABYSS_MARK_UNRESOLVED', detail: abyssMarkModifierIds.join(', ') });
  }

  const specialItems = registry.specialItems.map((s): SpecialItemDefinition => {
    const { uniqueNameEn, itemClassId, baseNamePrefix } = s.match;
    const baseItemIds = baseNamePrefix
      ? Object.keys(inputs.bases).filter((id) => inputs.bases[id]?.item_class === itemClassId && inputs.bases[id]?.name.startsWith(baseNamePrefix)).sort()
      : [];
    const uniqueNamesEn = uniqueNameEn && Object.values(inputs.uniques).some((u) => u.name === uniqueNameEn) ? [uniqueNameEn] : [];
    if (baseItemIds.length === 0 && uniqueNamesEn.length === 0) issues.push({ code: 'SPECIAL_ITEM_UNRESOLVED', detail: JSON.stringify(s.match) });
    return { handling: s.handling, baseItemIds, uniqueNamesEn, evidence: s.evidence };
  });

  // Pool display names (spec 017 B3): every Lich/special pool that occurs has exactly one name,
  // and the name occurs in the canonical names of that pool's rows or in the quoted evidence.
  const poolIds = [...new Set(modifiers.flatMap((m): PoolCategoryId[] => [...(m.lichPool ? [`lich:${m.lichPool}` as const] : []), ...m.specialPools.map((p) => `special:${p}` as const)]))].sort();
  const poolNamesEn = poolIds.flatMap((poolId): PoolNameDefinition[] => {
    const rules = registry.poolNames.filter((p) => p.poolId === poolId);
    const [rule] = rules;
    if (rules.length !== 1 || !rule) {
      issues.push({ code: 'POOL_NAME_UNRESOLVED', detail: `${poolId}: ${rules.length} rule entries` });
      return [];
    }
    const rows = modifiers.filter((m) => (poolId.startsWith('lich:') ? `lich:${m.lichPool}` === poolId : m.specialPools.some((p) => `special:${p}` === poolId)));
    const inRows = rows.some((m) => m.canonicalNameEn.includes(rule.nameEn));
    const inEvidence = rule.evidence.evidenceRefs.some((ref) => provenance[ref]?.notes?.includes(rule.nameEn));
    if (!inRows && !inEvidence) issues.push({ code: 'POOL_NAME_UNEVIDENCED', detail: `${poolId}: ${rule.nameEn}` });
    return [{ poolId: rule.poolId, nameEn: rule.nameEn, evidence: rule.evidence }];
  });
  for (const p of registry.poolNames) if (!poolIds.includes(p.poolId)) issues.push({ code: 'POOL_NAME_UNUSED', detail: p.poolId });

  // EN stat translations limited to stats used by included modifiers.
  const neededStats = new Set(modifiers.flatMap((m) => m.stats.map((s) => s.id)));
  const statTranslationsEn: StatTranslationEntry[] = inputs.statDescriptions
    .filter((e) => e.ids.some((id) => neededStats.has(id)))
    .map((e) => ({
      statIds: [...e.ids],
      variants: e.English.map((v) => ({ template: v.string, conditions: v.condition, formats: v.format, indexHandlers: v.index_handlers })),
    }));
  const translated = new Set(statTranslationsEn.flatMap((e) => e.statIds));
  const statsWithoutTranslation = [...neededStats].filter((id) => !translated.has(id)).sort();

  const nameIndexEn: EntityNameIndex = {
    baseItemsByName: indexByName(baseItems.map((b) => ({ id: b.id, name: b.canonicalNameEn }))),
    itemClassesByName: indexByName(itemClasses.map((c) => ({ id: c.id, name: c.canonicalNameEn }))),
    modifiersByName: indexByName(modifiers.map((m) => ({ id: m.id, name: m.canonicalNameEn }))),
  };

  const content: DataPackContent = {
    provenance: Object.fromEntries(Object.entries(provenance).sort(([a], [b]) => a.localeCompare(b))),
    itemClasses,
    baseItems,
    modifiers,
    statTranslationsEn,
    nameIndexEn,
    bones,
    omens,
    otherCurrencies,
    itemClassTargets: registry.itemClassTargets.map(({ itemClassId, target: t, evidence }) => ({ itemClassId, target: t, evidence })),
    affixLimits: registry.affixLimits,
    mechanicsConstants: registry.constants,
    abyssMarkModifierIds,
    specialItems,
    poolNamesEn,
  };

  const evidenceTimes = registry.evidence.map((e) => e.retrievedAt).filter((t): t is string => t !== undefined);
  const generatedAt = [inputs.record.retrievedAt, ...evidenceTimes].sort().at(-1) ?? inputs.record.retrievedAt;
  const pack: DataPack = {
    manifest: {
      schemaVersion: DATA_PACK_SCHEMA_VERSION,
      targetGameVersion: target.targetGameVersion,
      generatedAt,
      sources: Object.values(content.provenance)
        .filter((p) => p.sourceUrl)
        .map((p) => ({
          name: p.sourceName,
          url: p.sourceUrl ?? '',
          ...(p.observedVersion ? { observedVersion: p.observedVersion } : {}),
          ...(p.sha256 ? { sha256: p.sha256 } : {}),
        })),
      localizationLocales: ['en'],
      repoeObservedVersion: inputs.record.observedVersion,
      dataPackId: computeDataPackId(content),
      rulesEvidenceDigest: rulesDigest,
      stale: target.stale,
      validated: false,
    },
    ...content,
  };

  return {
    pack,
    report: { issues, lichAudit, droppedModsByDomain: droppedByDomain, statsWithoutTranslation, excludedUnreachableDesecrated, resolvedEntities: allEntities.resolved, resolvedOverrides },
  };
}
