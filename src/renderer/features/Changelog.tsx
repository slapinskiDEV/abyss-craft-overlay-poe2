import { useTranslation } from 'react-i18next';
import type { ChangelogEntryId } from '../../shared/changelog';

/** Release notes after an update, in the UI language (spec 011). */
export function ChangelogDialog({ entries, onClose }: { entries: readonly ChangelogEntryId[]; onClose: () => void }) {
  const { t } = useTranslation('changelog');
  return (
    <div className="dialog-backdrop">
      <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="changelog-title">
        <h2 id="changelog-title">{t('title')}</h2>
        {entries.map((id) => (
          <div key={id} className="changelog-entry">
            <h3>{t(`entries.${id}.heading`)}</h3>
            <ul>
              {(t(`entries.${id}.items`, { returnObjects: true }) as string[]).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
        <button type="button" className="primary" autoFocus onClick={onClose}>
          {t('close')}
        </button>
      </section>
    </div>
  );
}
