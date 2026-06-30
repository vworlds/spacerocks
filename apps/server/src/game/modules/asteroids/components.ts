import { Module, Singleton } from '@vworlds/vecs';
import { Asteroid, AsteroidView } from '@spacerocks/common';

/**
 * Running total of live asteroid mass, held as a singleton so the world owns
 * it (no module-level per-world map). Maintained reactively by the
 * `TrackAsteroidMass` system; read O(1) via the captured instance.
 */
export class AsteroidMassTotal {
  total = 0;
}

/**
 * Registers the asteroid components: `Asteroid`/`AsteroidView` (common) and
 * the `AsteroidMassTotal` singleton. Physics shape components
 * (`Material`, `Detectable`, `PhysicsPolygon`) are registered by
 * `PhysicsModule`, which must be loaded before the asteroids factory runs.
 */
export class Components extends Module {
  override init(): void {
    this.world.component(Asteroid);
    this.world.component(AsteroidView);
    this.world.component(AsteroidMassTotal).add(Singleton);
  }
}
