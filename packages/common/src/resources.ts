/**
 * Resource type identity + per-type display data (design #40 §8.1).
 *
 * A {@link ResourceType} is the shared identity of a resource container —
 * Ore, Crystal, or Alloy. It lines up with the {@link Price} keys from
 * `economy.ts` (tuple order `(ore, crystal, alloy)` is normative everywhere),
 * so the same string-literal union keys both the economy vocabulary and the
 * container display map.
 *
 * `RESOURCE_DISPLAY` is pure data/config: the per-type `color` (u32 RGB, for
 * vecs-phaser `FillStyle`) and the centered `char` rendered by the EXISTING
 * client render pipeline. Server factories derive color+char from this map;
 * the client never imports resource logic — it renders the `Rectangle` +
 * `Text` components it already receives. No new networked component is needed
 * (color travels on `FillStyle`; the character travels on `Text`).
 */

/**
 * The three resource types. A string-literal union (not an enum) so it
 * matches the `Price` keys in `economy.ts` directly — `priceContainers`
 * produces containers keyed by these exact strings.
 */
export type ResourceType = 'ore' | 'crystal' | 'alloy';

/** The three resource types in normative tuple order. */
export const RESOURCE_TYPES = [
  'ore',
  'crystal',
  'alloy',
] as const satisfies readonly ResourceType[];

/**
 * Per-type display identity: `color` is a u32 RGB for `FillStyle`, `char` is
 * the single character rendered centered on the container's square. Data
 * only — no logic, no spawn-site literals.
 */
export const RESOURCE_DISPLAY = {
  ore: { color: 0x8b5a2b, char: 'O' },
  crystal: { color: 0x00e5ff, char: 'C' },
  alloy: { color: 0xd8d8d8, char: 'A' },
} as const satisfies Record<ResourceType, { color: number; char: string }>;
