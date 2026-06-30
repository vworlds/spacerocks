import { Module } from '@vworlds/vecs';

export class GameStateView {
  state = 0;
  wave = 0;
  score = 0;
  status = '';
}

export class Components extends Module {
  override init(): void {
    this.world.component(GameStateView);
  }
}
