// Axis 3 — parser locales (SoT §5.7, §5.10, §9.3). Adding a locale = one adapter definition.
import type { DataPack } from '../../data/normalized/types';
import type { ClipboardParserAdapterDefinition, ParsedItemResult } from '../common/types';
import { normalizeClipboard } from '../common/text';
import { EN_PARSER_ADAPTER } from '../en/adapter';

export const PARSER_ADAPTERS = [EN_PARSER_ADAPTER] as const satisfies readonly ClipboardParserAdapterDefinition[];

export interface ClipboardParser {
  parse(raw: string, clipboardLocale: 'auto' | string): ParsedItemResult;
}

/** Builds adapters once per pack. The UI locale is never an input (SoT §9.3). */
export function createClipboardParser(
  pack: DataPack,
  definitions: readonly ClipboardParserAdapterDefinition[] = PARSER_ADAPTERS,
): ClipboardParser {
  const adapters = definitions.map((d) => ({ definition: d, adapter: d.create(pack) }));
  return {
    parse(raw, clipboardLocale) {
      // Any separator-like line suggests item structure; without it the text is not an item.
      const looksLikeItem = normalizeClipboard(raw).some((l) => /^-{4,}$/.test(l));
      const scored = adapters
        .filter(({ definition }) => clipboardLocale === 'auto' || definition.locale === clipboardLocale)
        .map((a) => ({ ...a, score: a.adapter.detect(raw) }))
        .sort((x, y) => y.score - x.score);
      const [best, runnerUp] = scored;
      const confident = best !== undefined && best.score >= best.definition.threshold && (runnerUp === undefined || best.score > runnerUp.score);
      if (!confident || !best) {
        return {
          ok: false,
          confidence: 'insufficient',
          diagnostics: [{ code: looksLikeItem ? 'UNSUPPORTED_CLIPBOARD_LOCALE' : 'NOT_A_POE2_ITEM', severity: 'error' }],
        };
      }
      return best.adapter.parse(raw);
    },
  };
}
