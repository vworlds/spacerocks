import { Module } from '@vworlds/vecs';
import { ResourceContainer } from '@spacerocks/common';

/**
 * Registers the networked `ResourceContainer` component (defined in
 * `@spacerocks/common`). The container spawn factory lives in `./factories`
 * and is called by gameplay systems (loot, buffers — E3/E4/E5); this module
 * only owns the component registration so worlds that don't spawn containers
 * don't pay for it.
 */
export class Components extends Module {
  override init(): void {
    this.world.component(ResourceContainer);
  }
}

export { ResourceContainer } from '@spacerocks/common';
