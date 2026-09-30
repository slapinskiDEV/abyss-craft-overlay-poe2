// i18next instance factory for the renderer (SoT §4.1). Domain code never imports this.
import i18next, { type i18n } from 'i18next';
import { UI_LOCALES, UI_NAMESPACES, type UiLocale } from './ui/registry';

export async function createI18n(locale: UiLocale): Promise<i18n> {
  const instance = i18next.createInstance();
  await instance.init({
    lng: locale,
    fallbackLng: false, // a missing key is a test failure, not a silent EN fallback
    ns: [...UI_NAMESPACES],
    defaultNS: 'common',
    resources: Object.fromEntries(UI_LOCALES.map((l) => [l.id, l.resources])),
    interpolation: { escapeValue: false }, // React escapes output
    returnNull: false,
  });
  return instance;
}
