import { describe, expect, it } from 'vitest';

import {
  ZERO_PRICE,
  addPrice,
  canAfford,
  deduct,
  isZero,
  priceContainers,
  PRICE_RESOURCES,
  type Price,
} from '../src/index';

describe('Price tuple order', () => {
  it('exports resources in normative (ore, crystal, alloy) order', () => {
    expect(PRICE_RESOURCES).toEqual(['ore', 'crystal', 'alloy']);
  });

  it('exposes a frozen ZERO_PRICE identity', () => {
    expect(ZERO_PRICE).toEqual({ ore: 0, crystal: 0, alloy: 0 });
    expect(Object.isFrozen(ZERO_PRICE)).toBe(true);
    expect(isZero(ZERO_PRICE)).toBe(true);
  });
});

describe('isZero', () => {
  it('is true only when all three components are zero', () => {
    expect(isZero({ ore: 0, crystal: 0, alloy: 0 })).toBe(true);
    expect(isZero({ ore: 1, crystal: 0, alloy: 0 })).toBe(false);
    expect(isZero({ ore: 0, crystal: 1, alloy: 0 })).toBe(false);
    expect(isZero({ ore: 0, crystal: 0, alloy: 1 })).toBe(false);
  });
});

describe('canAfford', () => {
  const buffer: Price = { ore: 2, crystal: 1, alloy: 0 };

  it('true when buffer covers price exactly', () => {
    expect(canAfford(buffer, { ore: 2, crystal: 1, alloy: 0 })).toBe(true);
  });

  it('true when buffer has a surplus in every resource', () => {
    expect(canAfford(buffer, { ore: 1, crystal: 0, alloy: 0 })).toBe(true);
    expect(canAfford(buffer, { ore: 0, crystal: 1, alloy: 0 })).toBe(true);
    expect(canAfford(buffer, ZERO_PRICE)).toBe(true);
  });

  it('false when exactly one short on ore', () => {
    expect(canAfford(buffer, { ore: 3, crystal: 0, alloy: 0 })).toBe(false);
  });

  it('false when exactly one short on crystal', () => {
    expect(canAfford(buffer, { ore: 0, crystal: 2, alloy: 0 })).toBe(false);
  });

  it('false when exactly one short on alloy', () => {
    expect(canAfford(buffer, { ore: 0, crystal: 0, alloy: 1 })).toBe(false);
  });

  it('false when short on multiple resources at once', () => {
    expect(canAfford(buffer, { ore: 3, crystal: 2, alloy: 1 })).toBe(false);
  });

  it('true for a zero price against an empty buffer', () => {
    expect(canAfford(ZERO_PRICE, ZERO_PRICE)).toBe(true);
  });
});

describe('deduct — atomic semantics', () => {
  const buffer: Price = { ore: 2, crystal: 1, alloy: 0 };

  it('returns the post-deduct buffer for an exactly-affordable price', () => {
    expect(deduct(buffer, { ore: 2, crystal: 1, alloy: 0 })).toEqual(
      ZERO_PRICE,
    );
  });

  it('returns the post-deduct buffer for a partially-charged affordable price', () => {
    expect(deduct(buffer, { ore: 1, crystal: 0, alloy: 0 })).toEqual({
      ore: 1,
      crystal: 1,
      alloy: 0,
    });
  });

  it('deducting a zero price returns an equal buffer', () => {
    expect(deduct(buffer, ZERO_PRICE)).toEqual(buffer);
  });

  it('is pure — the input buffer is never mutated', () => {
    const snapshot: Price = { ...buffer };
    const result = deduct(buffer, { ore: 1, crystal: 1, alloy: 0 });
    expect(buffer).toEqual(snapshot);
    expect(result).not.toBe(buffer);
  });

  it('throws on an unaffordable price — no partial pay path exists', () => {
    // One short on each resource individually.
    expect(() => deduct(buffer, { ore: 3, crystal: 0, alloy: 0 })).toThrow();
    expect(() => deduct(buffer, { ore: 0, crystal: 2, alloy: 0 })).toThrow();
    expect(() => deduct(buffer, { ore: 0, crystal: 0, alloy: 1 })).toThrow();
    // Short on all three at once.
    expect(() => deduct(buffer, { ore: 3, crystal: 2, alloy: 1 })).toThrow();
  });

  it('leaves the buffer untouched when it throws', () => {
    const snapshot: Price = { ...buffer };
    expect(() => deduct(buffer, { ore: 99, crystal: 99, alloy: 99 })).toThrow();
    expect(buffer).toEqual(snapshot);
  });

  it('never partial-pays: a failed deduct does not produce a half-spent buffer', () => {
    // If a partial-pay path existed, deducting a multi-resource unaffordable
    // price could have side-effects. Because we throw *before* any arithmetic
    // and never mutate the input, this is structurally impossible — assert it
    // directly by attempting a throw and re-checking every component.
    const oreHeavy: Price = { ore: 5, crystal: 0, alloy: 0 };
    const snapshot: Price = { ...oreHeavy };
    expect(() => deduct(oreHeavy, { ore: 10, crystal: 5, alloy: 5 })).toThrow();
    expect(oreHeavy).toEqual(snapshot);
  });
});

describe('priceContainers — expansion', () => {
  it('expands (2,1,0) into 2 ore units + 1 crystal unit, in normative order', () => {
    expect(priceContainers({ ore: 2, crystal: 1, alloy: 0 })).toEqual([
      { resource: 'ore', amount: 1 },
      { resource: 'ore', amount: 1 },
      { resource: 'crystal', amount: 1 },
    ]);
  });

  it('expands (0,0,3) into 3 alloy units', () => {
    expect(priceContainers({ ore: 0, crystal: 0, alloy: 3 })).toEqual([
      { resource: 'alloy', amount: 1 },
      { resource: 'alloy', amount: 1 },
      { resource: 'alloy', amount: 1 },
    ]);
  });

  it('expands a mixed price (1,2,3) into 6 units in (ore, crystal, alloy) order', () => {
    expect(priceContainers({ ore: 1, crystal: 2, alloy: 3 })).toEqual([
      { resource: 'ore', amount: 1 },
      { resource: 'crystal', amount: 1 },
      { resource: 'crystal', amount: 1 },
      { resource: 'alloy', amount: 1 },
      { resource: 'alloy', amount: 1 },
      { resource: 'alloy', amount: 1 },
    ]);
  });

  it('expands a zero price into an empty array', () => {
    expect(priceContainers(ZERO_PRICE)).toEqual([]);
  });

  it('every container carries amount: 1', () => {
    const containers = priceContainers({ ore: 3, crystal: 2, alloy: 1 });
    expect(containers.every((c) => c.amount === 1)).toBe(true);
  });

  it('count matches the sum of components', () => {
    const price: Price = { ore: 2, crystal: 1, alloy: 4 };
    expect(priceContainers(price).length).toBe(
      price.ore + price.crystal + price.alloy,
    );
  });
});

describe('addPrice', () => {
  it('sums two prices component-wise', () => {
    expect(
      addPrice(
        { ore: 1, crystal: 2, alloy: 3 },
        { ore: 4, crystal: 5, alloy: 6 },
      ),
    ).toEqual({ ore: 5, crystal: 7, alloy: 9 });
  });

  it('treats ZERO_PRICE as identity', () => {
    const p: Price = { ore: 2, crystal: 1, alloy: 0 };
    expect(addPrice(p, ZERO_PRICE)).toEqual(p);
    expect(addPrice(ZERO_PRICE, p)).toEqual(p);
  });

  it('is pure — inputs are not mutated', () => {
    const a: Price = { ore: 1, crystal: 0, alloy: 0 };
    const b: Price = { ore: 0, crystal: 1, alloy: 0 };
    const result = addPrice(a, b);
    expect(a).toEqual({ ore: 1, crystal: 0, alloy: 0 });
    expect(b).toEqual({ ore: 0, crystal: 1, alloy: 0 });
    expect(result).not.toBe(a);
    expect(result).not.toBe(b);
  });
});
