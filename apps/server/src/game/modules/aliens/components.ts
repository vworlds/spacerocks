import { Module } from '@vworlds/vecs';
import { Alien } from '@spacerocks/common';

/**
 * Registers the `Alien` component. `Health` (which aliens also carry) is
 * registered by the `playerSessions` Components module.
 */
export class Components extends Module {
  override init(): void {
    this.world.component(Alien);
  }
}
