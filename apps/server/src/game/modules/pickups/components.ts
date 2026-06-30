import { Module } from '@vworlds/vecs';

export enum PickupKind {
  Shield = 'shield',
  Laser = 'laser',
  Aura = 'aura',
  Rocket = 'rocket',
  Boomerang = 'boomerang',
  Health = 'health',
}

export class Pickup {
  kind: PickupKind = PickupKind.Shield;
}

export class HealthPickup {
  amount = 0;
}

export class Components extends Module {
  override init(): void {
    this.world.component(Pickup);
    this.world.component(HealthPickup);
  }
}
