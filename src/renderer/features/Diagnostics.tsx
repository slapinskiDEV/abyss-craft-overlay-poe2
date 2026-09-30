import { useTranslation } from 'react-i18next';
import { diagnosticParams, type DiagnosticLike } from '../../i18n/format-diagnostic';
import { useGameTerms } from './game-terms';

export function DiagnosticList({ items, className }: { items: readonly DiagnosticLike[]; className?: string }) {
  const { t } = useTranslation();
  const game = useGameTerms();
  if (items.length === 0) return null;
  return (
    <ul className={className ?? 'diagnostics'}>
      {items.map((d, i) => {
        const params = diagnosticParams(d, game);
        return (
          <li key={`${d.code}-${i}`} data-code={d.code}>
            <strong>{t(`reasons:${d.code}.title`, params)}</strong> {t(`reasons:${d.code}.detail`, params)}
          </li>
        );
      })}
    </ul>
  );
}
