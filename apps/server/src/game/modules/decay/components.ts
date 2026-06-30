import { Module } from '@vworlds/vecs';
import { perFrame } from '@spacerocks/common';

export class Decay {
  life = 1;
  decay = perFrame(0.02);
}

export class Components extends Module {
  override init(): void {
    this.world.component(Decay);
  }
}
