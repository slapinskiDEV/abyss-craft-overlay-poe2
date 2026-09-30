// Domain diagnostics (SoT §5.8, §15): codes + params only, never user-facing text.
import { DIAGNOSTIC_CODE_DEFINITIONS, type DiagnosticCode, type DiagnosticSeverity } from '../../shared/diagnostic-codes';

export type ReasonCode = DiagnosticCode;
export type DiagnosticParams = Record<string, string | number | string[]>;

export interface Diagnostic {
  code: ReasonCode;
  severity: DiagnosticSeverity;
  params?: DiagnosticParams;
  uRef?: string;
  evidenceRefs?: string[];
}

const DEFINITIONS = new Map<string, { severity: DiagnosticSeverity; uRef?: string }>(
  DIAGNOSTIC_CODE_DEFINITIONS.map((d) => [d.code, d as { severity: DiagnosticSeverity; uRef?: string }]),
);

/** Builds a diagnostic with the registry's default severity and U-item reference. */
export function diag(code: ReasonCode, params?: DiagnosticParams, evidenceRefs?: string[]): Diagnostic {
  const def = DEFINITIONS.get(code);
  if (!def) throw new Error(`Unregistered diagnostic code ${code}`);
  return {
    code,
    severity: def.severity,
    ...(params ? { params } : {}),
    ...(def.uRef ? { uRef: def.uRef } : {}),
    ...(evidenceRefs && evidenceRefs.length > 0 ? { evidenceRefs } : {}),
  };
}
