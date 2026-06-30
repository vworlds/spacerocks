import { Module } from '@vworlds/vecs';

export class Wraps {}

export class Components extends Module {
  override init(): void {
    this.world.component(Wraps);
  }
}
