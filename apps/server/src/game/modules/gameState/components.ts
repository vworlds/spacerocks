import { Module } from '@vworlds/vecs';

/**
 * Singleton play-state marker. `state` is the only field: `0` = playing,
 * anything else = paused/lobby. Legacy wave/score/status counters were
 * retired by E1-T4 (asteroid-only clean slate).
 */
export class GameStateView {
  state = 0;
}

export class Components extends Module {
  override init(): void {
    this.world.component(GameStateView);
  }
}
