import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GAME_TERM_PROVIDERS } from '../../i18n/game/providers/registry';
import { UI_LOCALES } from '../../i18n/ui/registry';
import { PARSER_ADAPTERS } from '../../parser/registry';
import type { AppInfo, AppSettings, OverlayApi } from '../../preload/api-types';

// Language options come from the registries (SoT §5.10); MVP has one game-term and one parser locale.
export function SettingsPanel({ api, settings, appInfo, sources }: { api: OverlayApi; settings: AppSettings; appInfo: AppInfo | null; sources: Array<{ name: string; url: string; observedVersion?: string }> }) {
  const { t } = useTranslation();
  const [hotkey, setHotkey] = useState(settings.hotkey);
  const [hotkeyError, setHotkeyError] = useState<string | null>(null);
  const update = (patch: Partial<AppSettings>) => void api.updateSettings(patch);
  const setLocalization = (patch: Partial<AppSettings['localization']>) => update({ localization: { ...settings.localization, ...patch } });

  return (
    <section className="settings" aria-label={t('settings:title')}>
      <h2>{t('settings:title')}</h2>
      <label>
        {t('settings:uiLanguage')}
        <select value={settings.localization.uiLocale} onChange={(e) => setLocalization({ uiLocale: e.target.value })}>
          {UI_LOCALES.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t('settings:gameTermLanguage')}
        <select value={settings.localization.gameLocale} disabled={GAME_TERM_PROVIDERS.length < 2} onChange={(e) => setLocalization({ gameLocale: e.target.value })}>
          {GAME_TERM_PROVIDERS.map((p) => (
            <option key={p.locale} value={p.locale}>
              {UI_LOCALES.find((l) => l.id === p.locale)?.label ?? p.locale}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t('settings:clipboardLanguage')}
        <select value={settings.localization.clipboardLocale} onChange={(e) => setLocalization({ clipboardLocale: e.target.value })}>
          <option value="auto">{t('settings:clipboardAuto')}</option>
          {PARSER_ADAPTERS.map((a) => (
            <option key={a.locale} value={a.locale}>
              {UI_LOCALES.find((l) => l.id === a.locale)?.label ?? a.locale}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t('settings:hotkey')}
        <input value={hotkey} onChange={(e) => setHotkey(e.target.value)} />
        <button
          type="button"
          onClick={() =>
            void api.setHotkey(hotkey).then((r) => setHotkeyError(r.ok ? null : t(r.code === 'HOTKEY_INVALID' ? 'errors:hotkeyInvalid' : 'errors:hotkeyRegistrationFailed', { accelerator: r.accelerator })))
          }
        >
          {t('common:apply')}
        </button>
      </label>
      {hotkeyError ? <p role="alert">{hotkeyError}</p> : null}
      <label className="inline">
        <input type="checkbox" checked={settings.autoCopy} onChange={(e) => update({ autoCopy: e.target.checked })} />
        {t('settings:autoCopy', { copyShortcut: 'Ctrl+Alt+C' })}
      </label>
      {(['closeOnBlur', 'showLegacyCurrencies', 'showDataVersion', 'checkForUpdates'] as const).map((key) => (
        <label key={key} className="inline">
          <input type="checkbox" checked={settings[key]} onChange={(e) => update({ [key]: e.target.checked })} />
          {t(`settings:${key}`)}
        </label>
      ))}
      <button type="button" onClick={() => api.resetWindowPosition()}>
        {t('settings:resetWindowPosition')}
      </button>
      <h3>{t('about:title')}</h3>
      {appInfo ? <p>{t('about:appVersion', { version: appInfo.appVersion })}</p> : null}
      {/* SoT §3.3: the English notice is always shown verbatim, whatever the UI language. */}
      <p lang="en">This product isn't affiliated with or endorsed by Grinding Gear Games in any way.</p>
      <h4>{t('about:sources')}</h4>
      <ul className="sources">
        {sources.map((s) => (
          <li key={s.url}>
            {s.name} {s.observedVersion ?? ''} — {s.url}
          </li>
        ))}
      </ul>
    </section>
  );
}
