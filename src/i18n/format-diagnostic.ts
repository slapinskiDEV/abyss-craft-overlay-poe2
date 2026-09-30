// Renders a domain/parser diagnostic `{ code, params }` into localized text (SoT §5.8). Entity-ID
// params are resolved to official game terms before interpolation.
import type { GameLocalizationProvider } from './game/providers/types';

export interface DiagnosticLike {
  code: string;
  params?: Readonly<Record<string, string | number | readonly string[]>>;
}

export type Translate = (key: string, options?: Record<string, unknown>) => string;

const ENTITY_PARAMS: ReadonlyArray<[string, string, (g: GameLocalizationProvider, id: string) => string]> = [
  ['currencyId', 'currencyName', (g, id) => g.currencyName(id).text],
  ['omenId', 'omenName', (g, id) => g.omenName(id).text],
  ['baseItemId', 'baseItemName', (g, id) => g.baseItemName(id).text],
  ['itemClassId', 'itemClassName', (g, id) => g.itemClassName(id).text],
  ['modifierId', 'modifierText', (g, id) => g.modifierText(id).text],
];

export function diagnosticParams(diag: DiagnosticLike, game: GameLocalizationProvider): Record<string, unknown> {
  const params: Record<string, unknown> = { ...diag.params };
  for (const [idKey, nameKey, resolve] of ENTITY_PARAMS) {
    const id = diag.params?.[idKey];
    if (typeof id === 'string') params[nameKey] = resolve(game, id);
  }
  return params;
}

export function formatDiagnostic(diag: DiagnosticLike, t: Translate, game: GameLocalizationProvider): { title: string; detail: string } {
  const params = diagnosticParams(diag, game);
  return {
    title: t(`reasons:${diag.code}.title`, params),
    detail: t(`reasons:${diag.code}.detail`, params),
  };
}
