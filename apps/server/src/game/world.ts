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
  installPlayerSessionSystems(world);
  installSpawningSystems(world);
  installShootingSystems(world);
  installMovementSystems(world);
  installCombatSystems(world);
  await preloadPhysics();
  world.module(PhysicsModule, {
    gravity: { x: 0, y: 0 },
    fixedTimeStep: 1 / TICK_RATE,
    subSteps: 4,
  });
  world.module(PhaserServerModule);
  installEmbellishmentSystems(world);
  installHudSystems(world);
  installClientViewSystem(world, View);

  return world;
}
