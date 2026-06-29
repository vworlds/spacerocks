import { Singleton, type World } from '@vworlds/vecs';
import { Asteroid, AsteroidView } from '@spacerocks/common';
import {
  Detectable,
  Material,
  Polygon as PhysicsPolygon,
} from '@vworlds/vecs-physics';

/**
 * Running total of live asteroid mass, held as a singleton so the world owns
 * it (no module-level per-world map). Maintained reactively by the
 * `TrackAsteroidMass` system; read O(1) via the captured instance.
 */
export class AsteroidMassTotal {
  total = 0;
}

export function registerAsteroidsComponents(world: World): void {
  world.component(Asteroid);
  world.component(AsteroidView);
  world.component(AsteroidMassTotal).add(Singleton);
  world.component(Material);
  world.component(Detectable);
  world.component(PhysicsPolygon);
}
