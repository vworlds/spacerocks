import { Module } from '@vworlds/vecs';
import { registerGameStateComponents } from './components';
import { createGameStateEntity } from './helpers';

/**
 * Registers the `GameStateView` component and creates the singleton
 * game-state entity that tracks play state, wave, score, and status. Other
 * gameplay modules depend on this for `isPlaying` / `addScore` /
 * `createExplosion`.
 */
export class GameStateModule extends Module {
  override init(): void {
    registerGameStateComponents(this.world);
    createGameStateEntity(this.world);
  }
}
