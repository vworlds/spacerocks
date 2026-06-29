import { World } from '@vworlds/vecs';
import { phaserNetworkComponents } from '@vworlds/vecs-phaser';
import { PhysicsModule } from '@vworlds/vecs-physics';
import { Networked } from '@vworlds/vecs-server';
import { NETWORK_COMPONENTS, TICK_RATE } from '@spacerocks/common';
import { vi } from 'vitest';

/**
 * Mocks `@vworlds/vecs-server` so tests using the base `World` (not a real
 * `ServerWorld`) can import modules that reference `Networked` /
 * `NetworkClient` / `NetworkInput` without pulling in the server network
 * machinery. Call once at the top of a test file that loads gameplay modules.
 */
export function mockVecsServer(): void {
  vi.mock('@vworlds/vecs-server', () => ({
    NetworkClient: class NetworkClient {
      id = '';
    },
    NetworkInput: class NetworkInput {
      input: unknown;
    },
    Networked: class Networked {},
    View: class View {
      dsl: unknown;
    },
    ServerWorld: World,
    VecsListener: class VecsListener {
      registerWorld() {}
      async listen() {}
    },
  }));
}

export type WorldOptions = {
  /** Extra module classes to load after physics. */
  physics?: boolean;
};

/**
 * Builds a base `World` with the phaser network components + physics module
 * installed. Gameplay modules are loaded by the caller via `world.module(...)`.
 */
export function createBaseWorld(): World {
  const world = new World();
  for (const component of NETWORK_COMPONENTS) world.component(component);
  for (const component of phaserNetworkComponents) world.component(component);
  world.component(Networked);
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

export function countEntities(
  world: World,
  component: import('@vworlds/vecs').ComponentClass,
): number {
  let total = 0;
  world.filter([component]).forEach([], () => {
    total += 1;
  });
  return total;
}

export function firstEntity(
  world: World,
  component: import('@vworlds/vecs').ComponentClass,
): import('@vworlds/vecs').Entity {
  let found: import('@vworlds/vecs').Entity | undefined;
  world.filter([component]).forEach([], (entity) => {
    found ??= entity;
  });
  if (!found) throw new Error(`Expected ${component.name} entity`);
  return found;
}
