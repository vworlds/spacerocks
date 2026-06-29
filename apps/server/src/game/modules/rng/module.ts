import { Module, Singleton } from '@vworlds/vecs';
import { createPrng, WorldRng } from './components';

export type RngModuleConfig = {
  seed?: number;
};

const DEFAULT_SEED = 0x5eed1234;

export function readServerSeed(): number {
  const configuredSeed = Number(process.env.SPACEROCKS_SEED ?? DEFAULT_SEED);
  return Number.isFinite(configuredSeed) ? configuredSeed : DEFAULT_SEED;
}

/**
 * Registers the `WorldRng` singleton holding a seeded `Prng`. Other modules
 * (asteroids, aliens, pickups, combat) read it via `world.get(WorldRng)` and
 * capture the instance in their `init()`.
 */
export class RngModule extends Module<RngModuleConfig | undefined> {
  override init(config: RngModuleConfig | undefined): void {
    const seed = config?.seed ?? readServerSeed();
    this.world.component(WorldRng).add(Singleton);
    this.world.set(WorldRng, { prng: createPrng(seed) } as WorldRng);
  }
}

export type { Prng } from './components';
