import { Module, Singleton } from '@vworlds/vecs';
import type { AssetManager } from '@vworlds/vecs-phaser-server';

/**
 * Server-only singleton wrapping the {@link AssetManager}. Stored on the world
 * by `AssetsModule` so server modules can resolve tilesets without the world
 * setup knowing any asset specifics. Plain class (no `@wireType`): it never
 * crosses the wire.
 */
export class WorldAssets {
  manager: AssetManager | undefined;
}

/**
 * Registers the `WorldAssets` component as a singleton.
 */
export class Components extends Module {
  override init(): void {
    this.world.component(WorldAssets).add(Singleton);
  }
}
