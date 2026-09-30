// Multi-monitor / DPI safety for saved bounds (spec 001). Pure.
import type { WindowBounds } from '../preload/api-types';

export interface Rect { x: number; y: number; width: number; height: number }

/** Saved bounds are kept only if their top-left 80x40 grab area lies inside some display work area. */
export function restoreBounds(saved: WindowBounds, workAreas: readonly Rect[], primary: Rect): Rect {
  const width = Math.min(saved.width, primary.width);
  const height = Math.min(saved.height, primary.height);
  if (saved.x !== undefined && saved.y !== undefined) {
    const grab = { x: saved.x, y: saved.y, width: 80, height: 40 };
    const visible = workAreas.some((a) => grab.x >= a.x && grab.y >= a.y && grab.x + grab.width <= a.x + a.width && grab.y + grab.height <= a.y + a.height);
    if (visible) return { x: saved.x, y: saved.y, width, height };
  }
  return { x: primary.x + Math.round((primary.width - width) / 2), y: primary.y + Math.round((primary.height - height) / 4), width, height };
}
