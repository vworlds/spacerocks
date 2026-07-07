/**
 * Economy vocabulary: Price + time primitives.
 *
 * One cost/time vocabulary for the whole economy. Every resource cost in the
 * game — construction, production inputs, maintenance drains, ammo — is
 * expressed as a {@link Price}, and every timed process runs in float
 * wall-clock **seconds** (never ticks; robust to slowed sectors, design #40
 * §3.1/§8.2).
 *
 * These are plain data shapes + pure functions. No classes with behavior, no
 * world/entity imports — safe to use from both server systems and client HUD
 * code, and friendly to embed as component fields later (vecs design guide §3).
 *
 * Tuple order `(ore, crystal, alloy)` is normative everywhere (design #40
 * reconciliation note 1).
 */

/**
 * A resource cost. Tuple order `(ore, crystal, alloy)` is normative
 * everywhere. All amounts are non-negative integers (container counts).
 */
export type Price = {
  ore: number;
  crystal: number;
  alloy: number;
};

/**
 * One-shot production: deduct `price` atomically from the producer's buffer,
 * run a `duration`-second timer (float wall-clock seconds), then emit the
 * output. Loops while ordered. `duration: 0` is legal (instant conversion,
 * e.g. turret ammo).
 *
 * @see design #40 §8.2.
 */
export type Production = {
  price: Price;
  /** Float wall-clock seconds. */
  duration: number;
};

/**
 * Recurring maintenance: deduct `price` every `period` seconds. If unpayable
 * on a period boundary, the maintained effect drops.
 *
 * @see design #40 §8.2.
 */
export type Maintenance = {
  price: Price;
  /** Float wall-clock seconds. */
  period: number;
};

/** A zero Price — useful default/identity for additive folds. */
export const ZERO_PRICE: Price = Object.freeze({
  ore: 0,
  crystal: 0,
  alloy: 0,
});

/** The three resource names, in normative tuple order. */
export const PRICE_RESOURCES = [
  'ore',
  'crystal',
  'alloy',
] as const satisfies readonly (keyof Price)[];

/**
 * A single container unit of a resource. `priceContainers` expands a
 * {@link Price} into these.
 *
 * TODO(E1-T3): align `resource` with the `ResourceType` enum introduced by
 * E1-T3 (design #40 §8.1). Until that lands we key by the resource name.
 */
export type PriceContainer = {
  resource: keyof Price;
  /** Always 1 — one container per unit. Included so callers can scale if needed. */
  amount: 1;
};

/** True when every component of `price` is zero. */
export function isZero(price: Price): boolean {
  return price.ore === 0 && price.crystal === 0 && price.alloy === 0;
}

/** True iff `buffer` holds at least `price` of every resource. */
export function canAfford(buffer: Price, price: Price): boolean {
  return (
    buffer.ore >= price.ore &&
    buffer.crystal >= price.crystal &&
    buffer.alloy >= price.alloy
  );
}

/**
 * Add two Prices component-wise. Returns a fresh Price; inputs are unchanged.
 */
export function addPrice(a: Price, b: Price): Price {
  return {
    ore: a.ore + b.ore,
    crystal: a.crystal + b.crystal,
    alloy: a.alloy + b.alloy,
  };
}

/**
 * Atomically deduct `price` from `buffer`.
 *
 * **Pure / immutable variant:** returns the resulting buffer; the input
 * `buffer` is never mutated. Throws if `buffer` cannot cover `price` in full
 * — there is no partial-pay path. Callers MUST guard with {@link canAfford}
 * (or wrap the call) when a graceful "wait" branch is needed.
 *
 * Atomicity is the design contract (design #40 §8.2): the consumer either
 * has the full Price and deducts it at once, or waits. Prices never carry
 * time and never partial-pay.
 */
export function deduct(buffer: Price, price: Price): Price {
  if (!canAfford(buffer, price)) {
    throw new Error(
      `deduct: buffer cannot cover price (have ${buffer.ore},${buffer.crystal},${buffer.alloy}; ` +
        `want ${price.ore},${price.crystal},${price.alloy})`,
    );
  }
  return {
    ore: buffer.ore - price.ore,
    crystal: buffer.crystal - price.crystal,
    alloy: buffer.alloy - price.alloy,
  };
}

/**
 * Expand a {@link Price} into its individual container units.
 *
 * `(2,1,0)` → `[ { ore, 1 }, { ore, 1 }, { crystal, 1 } ]`. Order is normative
 * (ore units first, then crystal, then alloy) so callers that care about
 * determinism get a stable sequence.
 *
 * TODO(E1-T3): coordinate the `resource` shape with E1-T3's `ResourceType`
 * enum (design #40 §8.1). Until E1-T3 lands, `resource` is keyed by the three
 * resource names.
 */
export function priceContainers(price: Price): PriceContainer[] {
  const containers: PriceContainer[] = [];
  for (const resource of PRICE_RESOURCES) {
    const count = price[resource];
    for (let i = 0; i < count; i++) {
      containers.push({ resource, amount: 1 });
    }
  }
  return containers;
}
