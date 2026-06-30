import { Module } from '@vworlds/vecs';
import { NetworkComponentsModule } from '@spacerocks/common';
import { createGameStateEntity } from './helpers';

/**
 * Creates the singleton game-state entity that tracks play state, wave,
 * score, and status. Other gameplay modules depend on this for `isPlaying` /
 * `addScore` / `createExplosion`. The `GameStateView` component is registered
 * by `NetworkComponentsModule`.
 */
export class GameStateModule extends Module {
  override init(): void {
    this.world.module(NetworkComponentsModule);
    createGameStateEntity(this.world);
  }
}
