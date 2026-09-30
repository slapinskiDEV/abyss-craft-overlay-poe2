import { EN_GAME_TERM_PROVIDER } from './en';
import type { GameLocalizationProvider, GameTermDiagnostic, GameTermProviderDefinition, LocalizedTerm } from './types';
import type { DataPack } from '../../../data/normalized/types';

export const GAME_TERM_PROVIDERS = [EN_GAME_TERM_PROVIDER] as const satisfies readonly GameTermProviderDefinition[];
export const CANONICAL_GAME_LOCALE = 'en';

/**
 * Creates the provider for `locale`, wrapped so that any term missing from a non-canonical
 * locale falls back to official EN with GAME_TERM_FALLBACK_EN (SoT §5.9) — never a translation.
 */
export function createGameTermProvider(
  pack: DataPack,
  locale: string,
  providers: readonly GameTermProviderDefinition[] = GAME_TERM_PROVIDERS,
): GameLocalizationProvider {
  const canonicalDef = providers.find((p) => p.locale === CANONICAL_GAME_LOCALE);
  if (!canonicalDef) throw new Error('Canonical EN game-term provider is not registered');
  const canonical = canonicalDef.create(pack);
  const requestedDef = providers.find((p) => p.locale === locale);
  if (!requestedDef || requestedDef.locale === CANONICAL_GAME_LOCALE) return canonical;

  const requested = requestedDef.create(pack);
  const fallbacks = new Map<string, GameTermDiagnostic>();
  const withFallback = (pick: (p: GameLocalizationProvider) => (id: string) => LocalizedTerm) => (id: string): LocalizedTerm => {
    const term = pick(requested)(id);
    if (!term.fallback) return term;
    if (!fallbacks.has(id)) fallbacks.set(id, { code: 'GAME_TERM_FALLBACK_EN', params: { entityId: id } });
    return { ...pick(canonical)(id), fallback: true };
  };
  return {
    locale: requested.locale,
    currencyName: withFallback((p) => p.currencyName),
    omenName: withFallback((p) => p.omenName),
    baseItemName: withFallback((p) => p.baseItemName),
    itemClassName: withFallback((p) => p.itemClassName),
    modifierText: withFallback((p) => p.modifierText),
    diagnostics: () => [...fallbacks.values(), ...canonical.diagnostics()],
  };
}
