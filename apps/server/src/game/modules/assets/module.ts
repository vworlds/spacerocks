import { Module } from '@vworlds/vecs';
import type { AssetManager } from '@vworlds/vecs-phaser-server';
import { Components, WorldAssets } from './components';

export type AssetsModuleConfig = {
  manager: AssetManager;
};

/**
 * Publishes the server's {@link AssetManager} as a `WorldAssets` singleton so
 * other modules (e.g. `playerSessions`) can resolve tilesets without the world
 * setup knowing any asset specifics. Omitted in tests → `pickShipSprite` falls
 * back to a no-op texture.
 */
export class AssetsModule extends Module<AssetsModuleConfig> {
  override init(config: AssetsModuleConfig): void {
    this.world.module(Components);
    this.world.set(WorldAssets, { manager: config.manager } as WorldAssets);
  }
}
