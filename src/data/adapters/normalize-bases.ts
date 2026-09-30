// RePoE base_items.json -> BaseItemDefinition[] for the item classes the product evaluates.
import type { BaseItemDefinition } from '../normalized/types';
import type { RawBaseItem } from './raw-types';

export function normalizeBases(
  bases: Readonly<Record<string, RawBaseItem>>,
  itemClassIds: ReadonlySet<string>,
  sourceFileRef: string,
): BaseItemDefinition[] {
  return Object.keys(bases)
    .sort()
    .flatMap((id): BaseItemDefinition[] => {
      const base = bases[id];
      if (!base || base.domain === undefined || !itemClassIds.has(base.item_class)) return [];
      return [
        {
          id,
          canonicalNameEn: base.name,
          itemClassId: base.item_class,
          tags: [...base.tags],
          domain: base.domain,
          releaseState: base.release_state,
          sourceRefs: [`${sourceFileRef}#${id}`],
        },
      ];
    });
}
