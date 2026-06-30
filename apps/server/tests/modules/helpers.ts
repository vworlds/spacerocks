import { World, type ComponentClass, type Entity } from '@vworlds/vecs';
import { PhysicsModule } from '@vworlds/vecs-physics';
import { NetworkComponentsModule, TICK_RATE } from '@spacerocks/common';
import {
  NetworkClient,
  NetworkInput,
  Networked,
  View,
} from '@vworlds/vecs-server';

/**
 * Registers the vecs-server network foundation components
 * (`Networked`, `NetworkClient`, `NetworkInput`, `View`) on a base `World`.
 * `ServerWorld` does this automatically; test worlds using a mocked
 * `@vworlds/vecs-server` must call this explicitly.
 */
export function registerNetworkFoundation(world: World): void {
  world.component(Networked);
  world.component(NetworkClient);
  world.component(NetworkInput);
  world.component(View);
}

/**
 * Builds a base `World` with the network foundation + common network
 * components registered. Gameplay modules are loaded by the caller via
 * `world.module(...)`.
 */
export function createBaseWorld(): World {
  const world = new World();
  registerNetworkFoundation(world);
  world.module(NetworkComponentsModule);
  return world;
}

/**
 * Builds a world with physics installed (no gameplay modules). Gameplay
 * modules are loaded by the caller.
 */
export function createPhysicsWorld(): World {
  const world = createBaseWorld();
  world.module(PhysicsModule, {
    gravity: { x: 0, y: 0 },
    fixedTimeStep: 1 / TICK_RATE,
    subSteps: 4,
  });
  return world;
}

export const DT_MS = 1000 / TICK_RATE;

export function stepTicks(world: World, ticks: number): void {
  for (let tick = 0; tick < ticks; tick += 1) {
    world.progress(tick * DT_MS, DT_MS);
  }
}

export function countEntities(world: World, component: ComponentClass): number {
  let total = 0;
  world.filter([component]).forEach([], () => {
    total += 1;
  });
  return total;
}

export function firstEntity(world: World, component: ComponentClass): Entity {
  let found: Entity | undefined;
  world.filter([component]).forEach([], (entity) => {
    found ??= entity;
  });
  if (!found) throw new Error(`Expected ${component.name} entity`);
  return found;
}
