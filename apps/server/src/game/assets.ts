/**
 * Server-only singleton wrapping the {@link AssetManager}. Stored on the world
 * by `createGameWorld` (`world.set(WorldAssets, { manager })`) so server modules
 * can resolve tilesets without `createGameWorld` knowing any asset specifics.
 * Plain class (no `@wireType`): it never crosses the wire.
 *
 */
import type { AssetManager } from '@vworlds/vecs-phaser-server';

export class WorldAssets {
  manager: AssetManager | undefined;
}
