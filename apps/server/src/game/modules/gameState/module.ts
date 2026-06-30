import { Module } from '@vworlds/vecs';
import { Components } from './components';
import { createGameStateEntity } from './helpers';

/**
 * Registers the `GameStateView` component as a singleton and creates the
 * singleton game-state entity that tracks play state, wave, score, and status.
 * Other gameplay modules depend on this for `isPlaying` / `addScore` /
 * `createExplosion`.
 */
export class GameStateModule extends Module {
  override init(): void {
    this.world.module(Components);
    createGameStateEntity(this.world);
  }
}
