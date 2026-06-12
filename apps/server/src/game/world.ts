import { ServerWorld, View } from '@vworlds/vecs-server';
import { phaserRenderableComponents } from '@vworlds/vecs-phaser';
import { NETWORK_COMPONENTS } from '@spacerocks/common';
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

export function createGameWorld(): ServerWorld {
  const world = new ServerWorld({
    name: 'main',
    networkComponents: NETWORK_COMPONENTS,
  });

  world.setExclusiveComponents(...phaserRenderableComponents);
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
  installEmbellishmentSystems(world);
  installHudSystems(world);
  installClientViewSystem(world, View);

  return world;
}
