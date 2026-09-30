// Shapes of the RePoE PoE2 export fields this project reads (SoT §6.2, §7.3).

export interface RawWeightEntry {
  tag: string;
  weight: number;
}

export interface RawMod {
  adds_tags: string[];
  domain: string;
  generation_type: string;
  generation_weights: RawWeightEntry[];
  groups: string[];
  implicit_tags: string[];
  is_essence_only: boolean;
  name: string;
  required_level: number;
  spawn_weights: RawWeightEntry[];
  stats: Array<{ id: string; min: number; max: number }>;
  text?: string;
  type: string;
}

export interface RawBaseItem {
  domain?: string;
  item_class: string;
  name: string;
  release_state: string;
  tags: string[];
  /** Official item text; `description` is the in-game "what it does" line (spec 019). */
  properties?: { description?: string };
}
