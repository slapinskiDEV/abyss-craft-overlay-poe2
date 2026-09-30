// Translation invariants (SoT §5.8, §17; spec 003/007). Pure checks over UI resources.
import { DIAGNOSTIC_CODES } from '../shared/diagnostic-codes';
import type { UiLocaleDefinition, UiNamespace } from './ui/registry';

export interface TranslationIssue { code: string; locale: string; key: string; detail?: string }

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;
const VARIABLE = /\{\{\s*([\w.]+)\s*\}\}/g;
// SoT §17: no probability wording in any UI string.
const PROBABILITY_WORDING = /%|\bchance|probab|\blikely\b|szans|prawdopodob/i;
// Keys that must mention probability only to deny it (SoT §16.5 union caption).
const WORDING_EXCEPTIONS: ReadonlySet<string> = new Set(['workspace:unionCoverageDisclaimer']);

export function flatten(value: unknown, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  if (typeof value === 'string') out.set(prefix, value);
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) for (const [fk, fv] of flatten(v, prefix ? `${prefix}.${k}` : k)) out.set(fk, fv);
  }
  return out;
}

/** base key -> { plural forms present, variables used (excluding `count`) } */
function describe(resources: Record<string, unknown>): Map<string, { forms: Set<string>; vars: Set<string> }> {
  const out = new Map<string, { forms: Set<string>; vars: Set<string> }>();
  for (const [ns, tree] of Object.entries(resources)) {
    for (const [key, text] of flatten(tree)) {
      const match = key.match(PLURAL_SUFFIX);
      const base = `${ns}:${match ? key.slice(0, -match[0].length) : key}`;
      const entry = out.get(base) ?? { forms: new Set<string>(), vars: new Set<string>() };
      if (match?.[1]) entry.forms.add(match[1]);
      for (const v of text.matchAll(VARIABLE)) if (v[1] && v[1] !== 'count') entry.vars.add(v[1]);
      out.set(base, entry);
    }
  }
  return out;
}

export function checkTranslations(locales: readonly UiLocaleDefinition[], allowlist: readonly string[] = []): TranslationIssue[] {
  const issues: TranslationIssue[] = [];
  const reference = locales.find((l) => l.id === 'en');
  if (!reference) return [{ code: 'REFERENCE_LOCALE_MISSING', locale: 'en', key: '' }];
  const ref = describe(reference.resources);
  const allowed = new Set(allowlist);

  for (const locale of locales) {
    const cur = describe(locale.resources);
    const categories = new Set(new Intl.PluralRules(locale.id).resolvedOptions().pluralCategories);
    for (const [key, info] of ref) {
      const own = cur.get(key);
      if (!own) {
        if (!allowed.has(key)) issues.push({ code: 'KEY_MISSING', locale: locale.id, key });
        continue;
      }
      if (info.forms.size > 0) {
        for (const c of categories) if (!own.forms.has(c)) issues.push({ code: 'PLURAL_FORM_MISSING', locale: locale.id, key, detail: c });
      }
      const refVars = [...info.vars].sort().join(',');
      const ownVars = [...own.vars].sort().join(',');
      if (refVars !== ownVars) issues.push({ code: 'VARIABLE_MISMATCH', locale: locale.id, key, detail: `${refVars} vs ${ownVars}` });
    }
    for (const key of cur.keys()) if (!ref.has(key) && !allowed.has(key)) issues.push({ code: 'ORPHAN_KEY', locale: locale.id, key });

    for (const code of DIAGNOSTIC_CODES) {
      for (const part of ['title', 'detail']) {
        if (!cur.has(`reasons:${code}.${part}`)) issues.push({ code: 'REASON_CODE_UNTRANSLATED', locale: locale.id, key: `reasons:${code}.${part}` });
      }
    }
    for (const [ns, tree] of Object.entries(locale.resources)) {
      for (const [key, text] of flatten(tree)) {
        if (PROBABILITY_WORDING.test(text) && !WORDING_EXCEPTIONS.has(`${ns}:${key}`)) issues.push({ code: 'PROBABILITY_WORDING', locale: locale.id, key: `${ns}:${key}`, detail: text });
      }
    }
  }
  return issues;
}

/**
 * SoT §5.8: official game-entity names must not be hardcoded in UI resources; they arrive via
 * interpolation params from the game-term provider. Whole-word, case-sensitive match.
 */
export function checkEntityLiterals(locales: readonly UiLocaleDefinition[], entityNames: readonly string[]): TranslationIssue[] {
  const issues: TranslationIssue[] = [];
  const patterns = [...new Set(entityNames)]
    .filter((n) => n.trim().length > 0)
    .map((n) => [n, new RegExp(`(^|[^\\p{L}\\p{N}])${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}\\p{N}])`, 'u')] as const);
  for (const locale of locales) {
    for (const [ns, tree] of Object.entries(locale.resources) as Array<[UiNamespace, unknown]>) {
      for (const [key, text] of flatten(tree)) {
        // Substring pre-check keeps this fast; the regex then enforces whole-word matching.
        for (const [name, re] of patterns) if (text.includes(name) && re.test(text)) issues.push({ code: 'ENTITY_LITERAL', locale: locale.id, key: `${ns}:${key}`, detail: name });
      }
    }
  }
  return issues;
}
