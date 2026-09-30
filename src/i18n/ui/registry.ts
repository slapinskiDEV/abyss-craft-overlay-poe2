// Axis 1 — UI locales (SoT §5.1, §5.7, §5.10). Adding a locale = one entry + its resource files.
import enAbout from './en/about.json';
import enChangelog from './en/changelog.json';
import enCommon from './en/common.json';
import enErrors from './en/errors.json';
import enOnboarding from './en/onboarding.json';
import enReasons from './en/reasons.json';
import enSettings from './en/settings.json';
import enWorkspace from './en/workspace.json';
import plAbout from './pl/about.json';
import plChangelog from './pl/changelog.json';
import plCommon from './pl/common.json';
import plErrors from './pl/errors.json';
import plOnboarding from './pl/onboarding.json';
import plReasons from './pl/reasons.json';
import plSettings from './pl/settings.json';
import plWorkspace from './pl/workspace.json';

export const UI_NAMESPACES = ['common', 'workspace', 'reasons', 'settings', 'onboarding', 'about', 'errors', 'changelog'] as const;
export type UiNamespace = (typeof UI_NAMESPACES)[number];
export type UiResources = Record<UiNamespace, Record<string, unknown>>;

export interface UiLocaleDefinition {
  id: string;
  label: string; // endonym
  resources: UiResources;
}

export const UI_LOCALES = [
  {
    id: 'en',
    label: 'English',
    resources: { common: enCommon, workspace: enWorkspace, reasons: enReasons, settings: enSettings, onboarding: enOnboarding, about: enAbout, errors: enErrors, changelog: enChangelog },
  },
  {
    id: 'pl',
    label: 'Polski',
    resources: { common: plCommon, workspace: plWorkspace, reasons: plReasons, settings: plSettings, onboarding: plOnboarding, about: plAbout, errors: plErrors, changelog: plChangelog },
  },
] as const satisfies readonly UiLocaleDefinition[];

export type UiLocale = (typeof UI_LOCALES)[number]['id'];
export const DEFAULT_UI_LOCALE: UiLocale = 'en';
