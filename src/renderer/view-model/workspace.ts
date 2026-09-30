// Workspace state + reducer (spec 006, 009; SoT §4.1: no external state library). Pure.
import type { ModifierFilters, ModifierView, PoolSource } from './rows';
import { DEFAULT_FILTERS } from './rows';

export interface WorkspaceState {
  rawText: string;
  boneId: string | null;
  omenIds: string[];
  /** Last Bone the user chose per Bone target group (spec 009); wins over the default (spec 014). */
  bonePreference: Record<string, string>;
  /** The user deselected the Bone for the current item; no default is re-applied until a new item. */
  boneCleared: boolean;
  selectedBranchId: string | 'union' | null;
  /** null = follow defaultPoolSource(). */
  poolSource: PoolSource | null;
  view: ModifierView;
  filters: ModifierFilters;
}

export const INITIAL_WORKSPACE: WorkspaceState = {
  rawText: '',
  boneId: null,
  omenIds: [],
  bonePreference: {},
  boneCleared: false,
  selectedBranchId: null,
  poolSource: null,
  view: 'eligible',
  filters: DEFAULT_FILTERS,
};

export type WorkspaceAction =
  | { type: 'clipboard'; text: string }
  | { type: 'bone'; boneId: string | null; targetGroup?: string }
  | { type: 'toggleOmen'; omenId: string }
  | { type: 'keepSelectable'; boneIds: ReadonlySet<string>; omenIds: ReadonlySet<string>; targetGroup?: string; defaultBoneId?: string }
  /** A new item was parsed: apply the default side filter for its free slots (spec 014). */
  | { type: 'itemDefaults'; sides: Array<'prefix' | 'suffix'> }
  | { type: 'branch'; branchId: string | 'union' }
  | { type: 'poolSource'; source: PoolSource }
  | { type: 'view'; view: ModifierView }
  | { type: 'filters'; patch: Partial<ModifierFilters> };

export function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case 'clipboard':
      return action.text === state.rawText ? state : { ...state, rawText: action.text, boneCleared: false, selectedBranchId: null, poolSource: null, view: 'eligible' };
    case 'bone':
      return {
        ...state,
        boneId: action.boneId,
        boneCleared: action.boneId === null,
        bonePreference: action.boneId && action.targetGroup ? { ...state.bonePreference, [action.targetGroup]: action.boneId } : state.bonePreference,
        selectedBranchId: null,
        poolSource: null,
      };
    case 'toggleOmen':
      return {
        ...state,
        omenIds: state.omenIds.includes(action.omenId) ? state.omenIds.filter((id) => id !== action.omenId) : [...state.omenIds, action.omenId],
        selectedBranchId: null,
        poolSource: null,
      };
    case 'keepSelectable': {
      // After a new item is parsed, drop selections that are no longer selectable (spec 006) and
      // restore the user's earlier Bone for this target group when it fits (spec 009), otherwise
      // pick the default Bone (spec 014). A Bone the user cleared in this item stays cleared.
      const remembered = action.targetGroup ? state.bonePreference[action.targetGroup] : undefined;
      const fallback = action.defaultBoneId && action.boneIds.has(action.defaultBoneId) ? action.defaultBoneId : null;
      const boneId =
        state.boneId && action.boneIds.has(state.boneId)
          ? state.boneId
          : state.boneCleared
            ? null
            : remembered && action.boneIds.has(remembered)
              ? remembered
              : fallback;
      const omenIds = state.omenIds.filter((id) => action.omenIds.has(id));
      return boneId === state.boneId && omenIds.length === state.omenIds.length ? state : { ...state, boneId, omenIds };
    }
    case 'itemDefaults':
      return { ...state, filters: { ...state.filters, sides: action.sides } };
    case 'branch':
      return { ...state, selectedBranchId: action.branchId };
    case 'poolSource':
      return { ...state, poolSource: action.source, selectedBranchId: null };
    case 'view':
      return { ...state, view: action.view };
    case 'filters':
      return { ...state, filters: { ...state.filters, ...action.patch } };
  }
}
