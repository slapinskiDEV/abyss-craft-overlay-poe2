import { useTranslation } from 'react-i18next';

// SoT §22.1 first-launch steps.
export function Onboarding({ hotkey, onDismiss }: { hotkey: string; onDismiss: () => void }) {
  const { t } = useTranslation();
  return (
    <section className="onboarding" aria-label={t('onboarding:title')}>
      <h2>{t('onboarding:title')}</h2>
      <ol>
        <li>{t('onboarding:step1')}</li>
        <li>{t('onboarding:step2', { hotkey: hotkey.replace('CommandOrControl', 'Ctrl'), copyShortcut: 'Ctrl+Alt+C' })}</li>
        <li>{t('onboarding:step3')}</li>
        <li>{t('onboarding:step4')}</li>
      </ol>
      <button type="button" onClick={onDismiss}>
        {t('onboarding:dismiss')}
      </button>
    </section>
  );
}
