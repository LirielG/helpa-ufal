/** The API stores no cover for an action, so the cover is drawn from the
 * action id. Hashing the id (instead of picking at random) keeps every action
 * on the same cover across renders, reloads, pages and devices.
 */
const GRADIENTS = [
  ["#00579A", "#1B75BB"],
  ["#0F766E", "#14B8A6"],
  ["#1E3A8A", "#6366F1"],
  ["#9A3412", "#F59E0B"],
  ["#831843", "#EC4899"],
  ["#14532D", "#65A30D"],
] as const;

const SHAPES = ["circles", "waves", "stripes", "dots"] as const;

export type ActionCoverShape = (typeof SHAPES)[number];

export interface ActionCoverVariant {
  /** Stable identifier of the combination, e.g. "3-1". */
  key: string;
  gradient: readonly [string, string];
  shape: ActionCoverShape;
}

// FNV-1a: tiny, stable across JS engines, and spreads similar ids
// ("action-1", "action-2") apart better than a plain char-code sum.
function hashId(id: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function getActionCoverVariant(id: string): ActionCoverVariant {
  const hash = hashId(id);
  const gradient = hash % GRADIENTS.length;
  // Uses other bits so gradient and shape do not move in lockstep.
  const shape = (hash >>> 8) % SHAPES.length;
  return {
    key: `${gradient}-${shape}`,
    gradient: GRADIENTS[gradient],
    shape: SHAPES[shape],
  };
}
