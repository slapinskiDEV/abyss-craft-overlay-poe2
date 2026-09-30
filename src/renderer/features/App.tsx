import { useEffect, useMemo, useState } from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import type { i18n as I18n } from 'i18next';
import type { DataPack } from '../../data/normalized/types';
import { createI18n } from '../../i18n/create-i18n';
import { createGameTermProvider } from '../../i18n/game/providers/registry';
import { isRegisteredUiLocale, resolveGameLocale } from '../../i18n/resolve-locale';
import { createClipboardParser } from '../../parser/registry';
import type { AppInfo, AppSettings, DataPackLoadResult, OverlayApi } from '../../preload/api-types';
import { pendingChangelog, LATEST_CHANGELOG_ENTRY } from '../../shared/changelog';
import { ChangelogDialog } from './Changelog';
import { WorkspaceErrorBoundary } from './ErrorBoundary';
import { GameTermsContext } from './game-terms';
import { Onboarding } from './Onboarding';
import { SettingsPanel } from './SettingsPanel';
import { UpdateButton } from './UpdateButton';
import { Workspace, type ParseFn } from './Workspace';

interface Props {
  api: OverlayApi;
  /** Test seam: replaces the clipboard parser (spec 006 tests). */
  parseOverride?: ParseFn;
}

export function App({ api, parseOverride }: Props) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [pack, setPack] = useState<DataPackLoadResult | null>(null);
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [i18n, setI18n] = useState<I18n | null>(null);

  useEffect(() => {
    void Promise.all([api.getSettings(), api.loadDataPack(), api.getAppInfo()]).then(async ([s, p, info]) => {
      setSettings(s);
      setPack(p);
      setAppInfo(info);
      setI18n(await createI18n(isRegisteredUiLocale(s.localization.uiLocale) ? s.localization.uiLocale : 'en'));
    });
    return api.onSettingsChanged(setSettings);
  }, [api]);

  // Live language switching without remounting the workspace (SoT §18.5).
  useEffect(() => {
    if (i18n && settings && i18n.language !== settings.localization.uiLocale) void i18n.changeLanguage(settings.localization.uiLocale);
  }, [i18n, settings]);

  if (!settings || !pack || !i18n) return null;
  return (
    <I18nextProvider i18n={i18n}>
      <Shell api={api} settings={settings} packResult={pack} appInfo={appInfo} parseOverride={parseOverride} />
    </I18nextProvider>
  );
}

function Shell({ api, settings, packResult, appInfo, parseOverride }: { api: OverlayApi; settings: AppSettings; packResult: DataPackLoadResult; appInfo: AppInfo | null; parseOverride?: ParseFn }) {
  const { t } = useTranslation();
  const [showSettings, setShowSettings] = useState(false);
  const pack: DataPack | null = packResult.ok ? packResult.pack : null;
  const game = useMemo(() => (pack ? createGameTermProvider(pack, resolveGameLocale(settings.localization.gameLocale)) : null), [pack, settings.localization.gameLocale]);
  const parse = useMemo<ParseFn | null>(() => {
    if (parseOverride) return parseOverride;
    if (!pack) return null;
    const parser = createClipboardParser(pack);
    return (raw, locale) => parser.parse(raw, locale);
  }, [pack, parseOverride]);

  const changelog = pendingChangelog(settings.changelogSeen);
  const busy = useCopyBusy(api);
  const hotkeyError = useHotkeyError(api, settings.hotkey);
  // The overlay keeps keyboard focus in the game (spec 015); only text fields take it, while typing.
  const isTextField = (el: EventTarget | null) => el instanceof HTMLElement && el.closest('input, select, textarea') !== null;

  return (
    <div
      className="app"
      onMouseDownCapture={(e) => {
        if (isTextField(e.target)) api.requestKeyboardFocus();
      }}
      onBlurCapture={(e) => {
        if (isTextField(e.target) && !isTextField(e.relatedTarget)) api.releaseKeyboardFocus();
      }}
    >
      {busy ? (
        <div className="busy-overlay" role="status" aria-label={t('common:copyingItem')}>
          <span className="busy-sigil" aria-hidden="true" />
        </div>
      ) : null}
      {changelog.length > 0 ? <ChangelogDialog entries={changelog} onClose={() => void api.updateSettings({ changelogSeen: LATEST_CHANGELOG_ENTRY })} /> : null}
      <div className="titlebar">
        <span className="drag brand">
          <span className="sigil" aria-hidden="true" />
          PoE2 Abyss Craft Overlay
        </span>
        <UpdateButton api={api} />
        <button type="button" className="icon" aria-label={t('common:settings')} aria-pressed={showSettings} onClick={() => setShowSettings((v) => !v)}>
          ⚙
        </button>
        <button type="button" className="icon" aria-label={t('common:close')} onClick={() => api.hideOverlay()}>
          ×
        </button>
      </div>
      {hotkeyError ? (
        <p className="banner warning" role="alert">
          {t('errors:hotkeyRegistrationFailed', { accelerator: hotkeyError })}
        </p>
      ) : null}
      {!pack || !game || !parse ? (
        <section className="blocking-error" role="alert">
          <strong>{t(`reasons:${packResult.ok ? 'DATA_PACK_MISSING' : packResult.code}.title`)}</strong>
          <p>{t(`reasons:${packResult.ok ? 'DATA_PACK_MISSING' : packResult.code}.detail`)}</p>
          <p className="notice">{t('about:gggNotice')}</p>
        </section>
      ) : (
        <GameTermsContext.Provider value={game}>
          {!settings.onboardingCompleted ? <Onboarding hotkey={settings.hotkey} onDismiss={() => void api.updateSettings({ onboardingCompleted: true })} /> : null}
          {showSettings ? <SettingsPanel api={api} settings={settings} appInfo={appInfo} sources={pack.manifest.sources} /> : null}
          <WorkspaceErrorBoundary api={api} t={t} appVersion={appInfo?.appVersion}>
            <Workspace api={api} pack={pack} parse={parse} settings={settings} appInfo={appInfo} />
          </WorkspaceErrorBoundary>
        </GameTermsContext.Provider>
      )}
    </div>
  );
}

/** The hotkey that could not be registered (e.g. taken by another program), or null (spec 017 A7). */
function useHotkeyError(api: OverlayApi, hotkey: string): string | null {
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    let current = true;
    api
      .getHotkeyStatus()
      .then((s) => current && setFailed(s && !s.ok ? s.accelerator : null))
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [api, hotkey]);
  return failed;
}

/** Loading state while the hotkey copies the hovered item (spec 016); self-clears after 3 s. */
function useCopyBusy(api: OverlayApi): boolean {
  const [busy, setBusy] = useState(false);
  useEffect(() => api.onCopyBusy(setBusy), [api]);
  useEffect(() => {
    if (!busy) return;
    const timer = setTimeout(() => setBusy(false), 3000);
    return () => clearTimeout(timer);
  }, [busy]);
  return busy;
}
