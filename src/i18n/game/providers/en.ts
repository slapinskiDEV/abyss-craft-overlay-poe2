// Canonical EN provider: every name comes from the data pack (RePoE snapshot), never hand-typed.
import type { DataPack } from '../../../data/normalized/types';
import type { GameLocalizationProvider, GameTermDiagnostic, GameTermProviderDefinition, LocalizedTerm } from './types';

/** RePoE mod text uses `[Target|Label]` / `[Label]` link markup; show the label only. */
export const stripRePoEMarkup = (text: string): string => text.replace(/\[([^\]|]*)\|([^\]]*)\]/g, '$2').replace(/\[([^\]]*)\]/g, '$1');

export function createEnProvider(pack: DataPack): GameLocalizationProvider {
  const names = new Map<string, string>();
  for (const e of [...pack.bones, ...pack.omens, ...pack.otherCurrencies]) names.set(e.id, e.canonicalNameEn);
  const bases = new Map(pack.baseItems.map((b) => [b.id, b.canonicalNameEn]));
  const classes = new Map(pack.itemClasses.map((c) => [c.id, c.canonicalNameEn]));
  const pools = new Map(pack.poolNamesEn.map((p) => [p.poolId, p.nameEn]));
  const modText = new Map(pack.modifiers.map((m) => [m.id, m.text ? stripRePoEMarkup(m.text) : m.canonicalNameEn]));

  const recorded = new Map<string, GameTermDiagnostic>();
  const lookup = (table: ReadonlyMap<string, string>, id: string): LocalizedTerm => {
    const text = table.get(id);
    if (text) return { text, locale: 'en', fallback: false };
    if (!recorded.has(id)) recorded.set(id, { code: 'GAME_TERM_MISSING', params: { entityId: id } });
    return { text: id, locale: 'en', fallback: true };
  };

  return {
    locale: 'en',
    currencyName: (id) => lookup(names, id),
    omenName: (id) => lookup(names, id),
    baseItemName: (id) => lookup(bases, id),
    itemClassName: (id) => lookup(classes, id),
    poolName: (id) => lookup(pools, id),
    modifierText: (id) => lookup(modText, id),
    diagnostics: () => [...recorded.values()],
  };
}

export const EN_GAME_TERM_PROVIDER: GameTermProviderDefinition = { locale: 'en', create: createEnProvider };
