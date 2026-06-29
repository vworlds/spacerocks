import { Image } from '@vworlds/vecs-phaser';
import { ENTITY_CONFIG } from '@spacerocks/common';
import { WorldAssets } from './components';
import type { World } from '@vworlds/vecs';

const SHIP_TILESET_KEY = 'spaceships';

// On-screen size of the spaceship sprite in meters. The 64px tile is scaled to
// the ship's collision diameter (2 × SHIP.RADIUS) so the art matches the body.
export const SHIP_SPRITE_SIZE_METERS = ENTITY_CONFIG.SHIP.RADIUS * 2;

/**
 * Pick a random spaceship sprite frame from the `WorldAssets` singleton's
 * `AssetManager`. Returns an `Image` component value (`texture` = catalog id,
 * `frame` = random index in `[0, tileCount)`). Falls back to
 * `{ texture: 0, frame: 0 }` when no asset manager is registered, so unit-test
 * worlds without assets render nothing without crashing.
 */
export function pickShipSprite(world: World): Image {
  const manager = world.get(WorldAssets)?.manager;
  if (!manager) return { texture: 0, frame: 0 } as Image;
  const tileset = manager.getTileset(SHIP_TILESET_KEY);
  const frame = Math.floor(Math.random() * tileset.tileCount);
  return { texture: tileset.id, frame } as Image;
}
