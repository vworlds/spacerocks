import { type World } from '@vworlds/vecs';
import { HealthPickup, Pickup } from '@spacerocks/common';

export function registerPickupsComponents(world: World): void {
  world.component(Pickup);
  world.component(HealthPickup);
}
