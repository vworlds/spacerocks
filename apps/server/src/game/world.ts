import { ServerWorld, View } from '@vworlds/vecs-server';
import { PhaserServerModule } from '@vworlds/vecs-phaser-server';
import { PhysicsModule, preloadPhysics } from '@vworlds/vecs-physics';
import { NETWORK_COMPONENTS, TICK_RATE } from '@spacerocks/common';
import {
  installPlayerSessionSystems,
  registerPlayerSessionComponents,
} from './playerSessions';
import { installMovementSystems } from './movement';
import { installSpawningSystems, registerSpawningComponents } from './spawning';
import { installShootingSystems, registerShootingComponents } from './shooting';
import { installCombatSystems, registerCombatComponents } from './combat';
import {
  installEmbellishmentSystems,
  registerEmbellishmentComponents,
} from './embellishments';
import { installHudSystems, registerHudComponents } from './hud';
import { installClientViewSystem } from '../network/clientViews';

export async function createGameWorld(): Promise<ServerWorld> {
  const world = new ServerWorld({
    name: 'main',
    networkComponents: NETWORK_COMPONENTS,
  });

  registerPlayerSessionComponents(world);
  registerSpawningComponents(world);
  registerShootingComponents(world);
  registerCombatComponents(world);
  registerEmbellishmentComponents(world);
  registerHudComponents(world);

  // Physics + render modules MUST be installed BEFORE any system that spawns
  // physics bodies. installSpawningSystems() spawns the wave-1 asteroids at
  // install time; entities created before PhysicsModule never get working Box2D
  // sensor shapes, so their collisions silently never fire (they still drift
  // because velocity integration needs no mass). PhaserServerModule stays ahead
  // of the embellishment/HUD systems so its PRE_STORE pose-sync runs before the
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
  installHudSystems(world);
  installClientViewSystem(world, View);

  return world;
}
