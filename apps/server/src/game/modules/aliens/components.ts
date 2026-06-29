import { type World } from '@vworlds/vecs';
import { Alien, Health } from '@spacerocks/common';

export function registerAliensComponents(world: World): void {
  world.component(Alien);
  world.component(Health);
}
