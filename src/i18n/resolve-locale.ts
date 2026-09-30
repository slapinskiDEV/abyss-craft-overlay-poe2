// Locale resolution (SoT §5.6). Pure; values are validated against the registries.
import { CANONICAL_GAME_LOCALE, GAME_TERM_PROVIDERS } from './game/providers/registry';
import { DEFAULT_UI_LOCALE, UI_LOCALES, type UiLocale } from './ui/registry';

/** Windows PL -> 'pl'; any other OS locale -> 'en' (SoT §5.6 auto defaults). */
export function resolveUiLocale(osLocale: string): UiLocale {
  const language = osLocale.toLowerCase().split(/[-_]/)[0] ?? '';
  return UI_LOCALES.find((l) => l.id === language)?.id ?? DEFAULT_UI_LOCALE;
}

export function isRegisteredUiLocale(id: string): id is UiLocale {
  return UI_LOCALES.some((l) => l.id === id);
}

/** MVP: official EN terminology for every UI locale (SoT §5.2). */
export function resolveGameLocale(requested: string): string {
  return GAME_TERM_PROVIDERS.some((p) => p.locale === requested) ? requested : CANONICAL_GAME_LOCALE;
}
