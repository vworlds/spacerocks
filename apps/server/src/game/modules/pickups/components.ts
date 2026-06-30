import { Module } from '@vworlds/vecs';
import { HealthPickup, Pickup } from '@spacerocks/common';

/**
 * Registers the pickup components: `Pickup` and `HealthPickup` (common).
 */
export class Components extends Module {
  override init(): void {
    this.world.component(Pickup);
    this.world.component(HealthPickup);
  }
}
