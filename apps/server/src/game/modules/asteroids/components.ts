import { Module, Singleton } from '@vworlds/vecs';

export class Asteroid {
  mass = 16;
  color = 0xaaaaaa;
}

export class AsteroidView {
  color = 0x888888;
  radius = 0.2;
  mass = 16;
}

/**
 * Running total of live asteroid mass, held as a singleton so the world owns
 * it (no module-level per-world map). Maintained reactively by the
 * `TrackAsteroidMass` system; read O(1) via the captured instance.
 */
export class AsteroidMassTotal {
  total = 0;
}

/**
 * Registers asteroid-owned components. Physics shape components are registered
 * by `PhysicsModule`.
 */
export class Components extends Module {
  override init(): void {
    this.world.component(Asteroid);
    this.world.component(AsteroidView);
    this.world.component(AsteroidMassTotal).add(Singleton);
  }
}
