import { ServerWorld } from '@vworlds/vecs-server';
import type { AssetManager } from '@vworlds/vecs-phaser-server';
import { PhaserServerModule } from '@vworlds/vecs-phaser-server';
import { PhysicsModule, preloadPhysics } from '@vworlds/vecs-physics';
import { NETWORK_COMPONENTS, TICK_RATE } from '@spacerocks/common';
import {
  installPlayerSessionSystems,
  registerPlayerSessionComponents,
} from './playerSessions';
import { WorldAssets } from './assets';
import { installMovementSystems } from './movement';
import { installSpawningSystems, registerSpawningComponents } from './spawning';
import { installShootingSystems, registerShootingComponents } from './shooting';
import { installCombatSystems, registerCombatComponents } from './combat';
import {
  installEmbellishmentSystems,
  registerEmbellishmentComponents,
} from './embellishments';
import {
  installInterestGrid,
  registerInterestGridComponents,
} from '../network/interestGrid';

export async function createGameWorld(
  assets?: AssetManager,
): Promise<ServerWorld> {
  const world = new ServerWorld({
    name: 'main',
    networkComponents: NETWORK_COMPONENTS,
  });

  registerPlayerSessionComponents(world);
  registerSpawningComponents(world);
  registerShootingComponents(world);
  registerCombatComponents(world);
  registerEmbellishmentComponents(world);
  registerInterestGridComponents(world);

  // Publish the AssetManager as a server-only singleton so pickShipSprite can
  // resolve tilesets without createGameWorld knowing any asset specifics.
  // Omitted in tests → pickShipSprite falls back to a no-op texture.
  if (assets) {
    world.component(WorldAssets);
    world.set(WorldAssets, { manager: assets });
  }

  // Physics + render modules MUST be installed BEFORE any system that spawns
  // physics bodies. installSpawningSystems() spawns the initial asteroids at
  // install time; entities created before PhysicsModule never get working Box2D
  // sensor shapes, so their collisions silently never fire (they still drift
  // because velocity integration needs no mass). PhaserServerModule stays ahead
  // of the embellishment systems so its PRE_STORE pose-sync runs before the
  // PRE_STORE child-follow systems.
  await preloadPhysics();
  world.module(PhysicsModule, {
    gravity: { x: 0, y: 0 },
    fixedTimeStep: 1 / TICK_RATE,
    subSteps: 4,
  });
  world.module(PhaserServerModule);

  installPlayerSessionSystems(world);
  installSpawningSystems(world);
  installShootingSystems(world);
  installMovementSystems(world);
  installCombatSystems(world);
  installEmbellishmentSystems(world);
  installInterestGrid(world);

  return world;
}
