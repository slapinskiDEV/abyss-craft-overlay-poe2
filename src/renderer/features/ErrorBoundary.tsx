// A render error in the workspace must not leave a blank overlay (spec 017 B1). The fallback offers
// reading the clipboard again and a debug report; a newly copied item resets it.
import { Component, type ReactNode } from 'react';
import type { TFunction } from 'i18next';
import type { OverlayApi } from '../../preload/api-types';

interface Props {
  api: OverlayApi;
  t: TFunction;
  appVersion: string | undefined;
  children: ReactNode;
}

interface State {
  error: Error | null;
  copied: boolean;
}

export class WorkspaceErrorBoundary extends Component<Props, State> {
  override state: State = { error: null, copied: false };
  private unsubscribe: (() => void) | null = null;

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { error: error instanceof Error ? error : new Error(String(error)), copied: false };
  }

  override componentDidMount(): void {
    this.unsubscribe = this.props.api.onClipboardSnapshot(() => this.reset());
  }

  override componentWillUnmount(): void {
    this.unsubscribe?.();
  }

  override componentDidCatch(error: unknown): void {
    console.error('workspace render error', error);
  }

  private reset(): void {
    if (this.state.error) this.setState({ error: null, copied: false });
  }

  private report(): string {
    const { error } = this.state;
    // No clipboard text: the player did not opt in here (spec 006 debug report).
    return [
      'PoE2 Abyss Craft Overlay debug report (render error)',
      `appVersion: ${this.props.appVersion ?? 'unknown'}`,
      `error: ${error?.name ?? 'Error'}: ${error?.message ?? ''}`,
      ...(error?.stack ? ['stack:', error.stack] : []),
    ].join('\n');
  }

  override render(): ReactNode {
    const { t, api } = this.props;
    if (!this.state.error) return this.props.children;
    return (
      <section className="blocking-error" role="alert">
        <strong>{t('errors:renderFailedTitle')}</strong>
        <p>{t('errors:renderFailedDetail')}</p>
        <p>
          <button type="button" className="primary" onClick={() => void api.readClipboard().then(() => this.reset())}>
            {t('common:retry')}
          </button>{' '}
          <button type="button" onClick={() => void api.writeDebugReport(this.report()).then(() => this.setState({ copied: true }))}>
            {t('common:copyDebugReport')}
          </button>
        </p>
        {this.state.copied ? <p role="status">{t('common:debugReportCopied')}</p> : null}
      </section>
    );
  }
}
