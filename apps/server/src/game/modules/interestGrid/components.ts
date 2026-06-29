import type { World } from '@vworlds/vecs';
import { InCell, cellTagComponents } from './grid';

export { InCell, cellTagComponents } from './grid';

export function registerInterestGridComponents(world: World): void {
  world.component(InCell);
  for (const CellTag of cellTagComponents) world.component(CellTag);
}
