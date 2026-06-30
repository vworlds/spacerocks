import { Module, Singleton } from '@vworlds/vecs';

/**
 * Running total of live asteroid mass, held as a singleton so the world owns
 * it (no module-level per-world map). Maintained reactively by the
 * `TrackAsteroidMass` system; read O(1) via the captured instance.
 */
export class AsteroidMassTotal {
  total = 0;
}

/**
 * Registers the `AsteroidMassTotal` singleton. `Asteroid`/`AsteroidView`
 * (common) are registered by `NetworkComponentsModule`; physics shape
 * components by `PhysicsModule`.
 */
export class Components extends Module {
  override init(): void {
    this.world.component(AsteroidMassTotal).add(Singleton);
  }
}
