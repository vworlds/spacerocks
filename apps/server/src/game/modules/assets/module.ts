import { Module, Singleton } from '@vworlds/vecs';
import type { AssetManager } from '@vworlds/vecs-phaser-server';
import { WorldAssets } from './components';

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
    this.world.component(WorldAssets).add(Singleton);
    this.world.set(WorldAssets, { manager: config.manager } as WorldAssets);
  }
}
