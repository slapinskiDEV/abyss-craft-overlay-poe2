import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { computeDataPackId } from '../../src/data/adapters/build-pack';
import { validatePack } from '../../src/data/adapters/validate-pack';
import { DATA_PACK_SCHEMA_VERSION, type DataPack, type DataPackContent } from '../../src/data/normalized/types';

const PACK_FILE = 'src/data/normalized/pack/pack.json';

const emptyContent = (): DataPackContent => ({
  provenance: {},
  itemClasses: [],
  baseItems: [],
  modifiers: [],
  statTranslationsEn: [],
  nameIndexEn: { baseItemsByName: {}, itemClassesByName: {}, modifiersByName: {} },
  bones: [],
  omens: [],
  otherCurrencies: [],
  itemClassTargets: [],
  affixLimits: [],
  mechanicsConstants: {},
  abyssMarkModifierIds: [],
  specialItems: [],
  poolNamesEn: [],
});

const withManifest = (content: DataPackContent): DataPack => ({
  manifest: {
    schemaVersion: DATA_PACK_SCHEMA_VERSION,
    targetGameVersion: 'TEST_ONLY',
    generatedAt: '1970-01-01T00:00:00.000Z',
    sources: [],
    localizationLocales: ['en'],
    repoeObservedVersion: 'TEST_ONLY',
    dataPackId: computeDataPackId(content),
    rulesEvidenceDigest: 'TEST_ONLY',
    stale: false,
    validated: false,
  },
  ...content,
});

describe('validatePack gates (SoT §7.9)', () => {
  it('rejects TEST_ONLY entities in pack content (SoT §0.2 rule 9, §18.3 #26)', () => {
    const content = emptyContent();
    content.itemClasses.push({ id: 'TEST_ONLY_CLASS', canonicalNameEn: 'TEST_ONLY_CLASS', sourceRefs: ['TEST_ONLY_REF'] });
    const codes = validatePack(withManifest(content)).map((i) => i.code);
    expect(codes).toContain('TEST_ONLY_IN_PACK');
  });

  it('detects a tampered pack via dataPackId', () => {
    const pack = withManifest(emptyContent());
    pack.abyssMarkModifierIds.push('tampered');
    expect(validatePack(pack).map((i) => i.code)).toContain('DATA_PACK_ID_MISMATCH');
  });

  it('fails closed on an empty pack (no desecrated rows, SoT invariants unprovable)', () => {
    const codes = new Set(validatePack(withManifest(emptyContent())).map((i) => i.code));
    expect(codes).toEqual(new Set(['DESECRATED_DOMAIN_MISSING', 'OTHERWORLDLY_MISSING', 'SOT_INVARIANT_MISMATCH']));
  });
});

describe.skipIf(!existsSync(PACK_FILE) && process.env.REQUIRE_REAL_DATA !== '1')('committed production pack', () => {
  it('is validated and passes every gate', () => {
    const pack = JSON.parse(readFileSync(PACK_FILE, 'utf8')) as DataPack;
    expect(pack.manifest.validated).toBe(true);
    expect(validatePack(pack)).toEqual([]);
  });

  it('names every Lich and special pool exactly once, with evidence (spec 017 B3)', () => {
    const pack = JSON.parse(readFileSync(PACK_FILE, 'utf8')) as DataPack;
    const pools = new Set(pack.modifiers.flatMap((m) => [...(m.lichPool ? [`lich:${m.lichPool}`] : []), ...m.specialPools.map((p) => `special:${p}`)]));
    expect(pack.poolNamesEn.map((p) => p.poolId).sort()).toEqual([...pools].sort());
    for (const p of pack.poolNamesEn) expect(p.evidence.evidenceRefs.every((ref) => pack.provenance[ref] !== undefined), p.poolId).toBe(true);
  });
});
