export type Prng = {
  next(): number;
  range(min: number, max: number): number;
  int(maxExclusive: number): number;
  bool(chance?: number): boolean;
};

export function createPrng(seed: number): Prng {
  let state = seed >>> 0;

  function next(): number {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  }

  return {
    next,
    range(min, max) {
      return min + next() * (max - min);
    },
    int(maxExclusive) {
      return Math.floor(next() * maxExclusive);
    },
    bool(chance = 0.5) {
      return next() < chance;
    },
  };
}

export function randomNormal(rng: Prng): number {
  let u = 0;
  let v = 0;

  while (u === 0) u = rng.next();
  while (v === 0) v = rng.next();

  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Server-only singleton holding the seeded PRNG. Modules read it via
 * `world.get(WorldRng)` and capture the `prng` instance locally in `init()`.
 */
export class WorldRng {
  prng: Prng | undefined;
}
