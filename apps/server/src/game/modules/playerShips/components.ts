import { Module } from '@vworlds/vecs';

export class PlayerShip {
  playerIndex = 0;
  color = 0xffffff;
}

export class Components extends Module {
  override init(): void {
    this.world.component(PlayerShip);
  }
}
