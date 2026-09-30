// Evaluation result model (SoT §14.6 + spec 005 additive fields).
import type { AffixSide, LichPool, ModifierSourceKind, OmenDefinition, SpecialPool } from '../../data/normalized/types';
import type { ParserConfidence } from '../../parser/common/types';
import type { Diagnostic, DiagnosticParams, ReasonCode } from '../diagnostics/diagnostic';

export type EvaluationStatus = 'valid' | 'valid_with_warning' | 'invalid' | 'unsupported' | 'unknown';
export type PoolCompleteness = 'final' | 'base_eligibility_only' | 'unknown';
export type OmenPhase = OmenDefinition['phase'];

export interface CandidateReason { code: ReasonCode; params?: DiagnosticParams }

export interface ModifierCandidate {
  modifierId: string;
  side: AffixSide;
  requiredLevel: number;
  tierFamilyId: string;
  sourceKind: ModifierSourceKind;
  lichPool?: LichPool;
  specialPools: SpecialPool[];
  sourceRefs: string[];
  notes: ReasonCode[];
}
export interface BlockedModifierCandidate extends ModifierCandidate { reasons: CandidateReason[] }
export interface ConditionalModifierCandidate extends ModifierCandidate { unresolvedAffixIndexes: number[] }

export interface PoolSummary {
  regular: number;
  exclusive: number;
  amanamu: number;
  ulaman: number;
  kurgal: number;
  otherworldly: number;
  jewelExclusive: number;
}

export type BranchKind = 'mark_replacement' | 'open_slot' | 'removal' | 'putrefaction' | 'base';

export interface DesecrationBranchResult {
  id: string;
  kind: BranchKind;
  side: AffixSide;
  removedAffixId?: string;
  removedAffixRawText?: string[];
  completeness: PoolCompleteness;
  completenessReasons: Diagnostic[];
  eligible: ModifierCandidate[];
  conditional: ConditionalModifierCandidate[];
  blocked: BlockedModifierCandidate[];
  poolSummary: PoolSummary;
}

/** Item-state-independent pool for the base (SoT §14.7). Never `final`. */
export interface BasePoolResult {
  status: EvaluationStatus;
  reasons: Diagnostic[];
  sides: DesecrationBranchResult[];
}

export interface RecoveryHint { kind: 'annul_desecrated_only'; omenId: string; currencyId: string }

export interface DataManifestSummary {
  dataPackId: string;
  schemaVersion: number;
  targetGameVersion: string;
  repoeObservedVersion: string;
  generatedAt: string;
  validated: boolean;
  stale: boolean;
}

export interface DesecrationEvaluation {
  status: EvaluationStatus;
  reasons: Diagnostic[];
  branches: DesecrationBranchResult[];
  recoveryHints: RecoveryHint[];
  parserConfidence: ParserConfidence;
  dataManifest: DataManifestSummary;
  mode: 'desecrate' | 'putrefaction';
  poolCompleteness: PoolCompleteness;
  reveal: { optionCount: number; rerollsAvailable: number };
  mechanicNotes: Diagnostic[];
  putrefaction?: { maxUnrevealed: number; fracturedKept: number; corrupts: true };
  basePool: BasePoolResult;
}
