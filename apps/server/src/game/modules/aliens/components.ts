import { Module } from '@vworlds/vecs';
import { toFrames } from '@spacerocks/common';

export class Alien {
  shootCooldown = toFrames(1_000);
}

export class Components extends Module {
  override init(): void {
    this.world.component(Alien);
  }
}
