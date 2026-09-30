// Serializable debug report (SoT §15.3). Raw clipboard text only with explicit consent.
import type { DesecrationEvaluation } from '../../domain/desecration/types';
import type { ParsedItemResult } from '../../parser/common/types';
import type { AppInfo } from '../../preload/api-types';

export interface DebugReportInput {
  appInfo: AppInfo | null;
  parse: ParsedItemResult | null;
  evaluation: DesecrationEvaluation | null;
  boneId: string | null;
  omenIds: readonly string[];
  includeRawText: boolean;
  rawText: string;
  gameTermDiagnostics: readonly unknown[];
}

export function buildDebugReport(input: DebugReportInput): string {
  const { parse, evaluation } = input;
  const report = {
    appVersion: input.appInfo?.appVersion ?? null,
    platform: input.appInfo?.platform ?? null,
    dataManifest: evaluation?.dataManifest ?? input.appInfo?.dataManifest ?? null,
    parser: parse
      ? {
          ok: parse.ok,
          confidence: parse.confidence,
          locale: parse.ok ? parse.item.parserLocale : null,
          baseItemId: parse.ok ? parse.item.baseItemId ?? null : null,
          itemClassId: parse.ok ? parse.item.itemClassId ?? null : null,
          diagnostics: parse.diagnostics.map((d) => ({ code: d.code, params: d.params ?? null })),
        }
      : null,
    selection: { boneId: input.boneId, omenIds: [...input.omenIds] },
    evaluation: evaluation
      ? {
          status: evaluation.status,
          mode: evaluation.mode,
          poolCompleteness: evaluation.poolCompleteness,
          reasons: evaluation.reasons.map((r) => ({ code: r.code, uRef: r.uRef ?? null, evidenceRefs: r.evidenceRefs ?? [] })),
          branches: evaluation.branches.map((b) => ({ id: b.id, completeness: b.completeness, eligible: b.eligible.length, conditional: b.conditional.length, blocked: b.blocked.length })),
          basePool: {
            status: evaluation.basePool.status,
            reasons: evaluation.basePool.reasons.map((r) => ({ code: r.code, uRef: r.uRef ?? null })),
            sides: evaluation.basePool.sides.map((b) => ({ id: b.id, completeness: b.completeness, eligible: b.eligible.length, blocked: b.blocked.length })),
          },
        }
      : null,
    gameTermDiagnostics: input.gameTermDiagnostics,
    ...(input.includeRawText ? { rawText: input.rawText } : {}),
  };
  return JSON.stringify(report, null, 2);
}
