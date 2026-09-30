// TEST_ONLY raw RePoE-shaped rows (SoT §0.2 rule 9, §18.1). Role-named, never real IDs/names.
import type { RawMod } from '../../src/data/adapters/raw-types';

export const rawMod = (overrides: Partial<RawMod>): RawMod => ({
  adds_tags: [],
  domain: 'item',
  generation_type: 'suffix',
  generation_weights: [],
  groups: ['TEST_ONLY_GROUP'],
  implicit_tags: [],
  is_essence_only: false,
  name: 'TEST_ONLY_NAME',
  required_level: 1,
  spawn_weights: [{ tag: 'default', weight: 0 }],
  stats: [{ id: 'TEST_ONLY_stat', min: 1, max: 2 }],
  type: 'TEST_ONLY_TYPE',
  ...overrides,
});
