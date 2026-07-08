import { Module } from '@vworlds/vecs';
import { DecayModule } from '../decay/module';
import { Components } from './components';
import { createGameStateEntity } from './helpers';

/**
 * Creates the singleton game-state entity that tracks play state. Other
 * gameplay modules depend on this for `isPlaying` / `createExplosion`.
 */
export class GameStateModule extends Module {
  override init(): void {
    this.world.module(DecayModule);
    this.world.module(Components);
    createGameStateEntity(this.world);
  }
}
