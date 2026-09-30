import { describe, expect, it } from 'vitest';
import { normalizeMods } from '../../src/data/adapters/normalize-mods';
import { rawMod } from './test-only-raw';

const base = {
  regularDomains: ['item'],
  jewelBaseTagSets: [],
  lichOverrides: new Map(),
  sourceFileRef: 'TEST_ONLY_FILE',
};

describe('normalizeMods', () => {
  const result = normalizeMods({
    ...base,
    mods: {
      TEST_ONLY_REGULAR: rawMod({ generation_type: 'prefix' }),
      TEST_ONLY_EXCLUSIVE: rawMod({ domain: 'desecrated', name: 'of Kurgal', implicit_tags: ['kurgal_mod'] }),
      TEST_ONLY_CONFLICT: rawMod({ domain: 'desecrated', name: 'of Ulaman', implicit_tags: ['kurgal_mod'] }),
      TEST_ONLY_OTHER_DOMAIN: rawMod({ domain: 'TEST_ONLY_domain_other' }),
      TEST_ONLY_UNIQUE: rawMod({ generation_type: 'unique' }),
    },
  });
  const byId = new Map(result.modifiers.map((m) => [m.id, m]));

  it('keeps prefix/suffix rows of regular domains and the desecrated domain', () => {
    expect([...byId.keys()].sort()).toEqual(['TEST_ONLY_CONFLICT', 'TEST_ONLY_EXCLUSIVE', 'TEST_ONLY_REGULAR']);
    expect(result.droppedByDomain).toEqual({ TEST_ONLY_domain_other: 1 });
  });

  it('assigns sourceKind by domain and keeps Lich pool separate (SoT §7.2, §7.4)', () => {
    expect(byId.get('TEST_ONLY_REGULAR')?.sourceKind).toBe('regular');
    expect(byId.get('TEST_ONLY_EXCLUSIVE')).toMatchObject({ sourceKind: 'desecrated_exclusive', lichPool: 'kurgal', lichPoolConflict: false });
  });

  it('marks contradictory Lich rows and reports them for audit', () => {
    expect(byId.get('TEST_ONLY_CONFLICT')?.lichPoolConflict).toBe(true);
    expect(result.lichAudit.map((a) => a.modifierId)).toEqual(['TEST_ONLY_CONFLICT']);
  });

  it('attaches provenance to every record (SoT §0.3)', () => {
    for (const m of result.modifiers) expect(m.sourceRefs).toEqual([`TEST_ONLY_FILE#${m.id}`]);
  });
});
