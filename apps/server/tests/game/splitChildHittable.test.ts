import { World, type ComponentClass, type Entity } from '@vworlds/vecs';
import { phaserNetworkComponents, Position } from '@vworlds/vecs-phaser';
import {
  Body,
  BodyType,
  Circle,
  CollisionFilter,
  PhysicsModule,
  Position as PhysicsPosition,
  Sensor,
  SensorEvents,
} from '@vworlds/vecs-physics';
import {
  Asteroid,
  Bullet,
  CAT_ASTEROID,
  CAT_PLAYER_BULLET,
  ENTITY_CONFIG,
  Explosion,
  GameStateView,
} from '@spacerocks/common';
import { describe, expect, it, vi } from 'vitest';
import {
  installCombatSystems,
  registerCombatComponents,
} from '../../src/game/combat';
import { registerPlayerSessionComponents } from '../../src/game/playerSessions';
import { createPrng } from '../../src/game/rng';
import {
  createAsteroid,
  registerSpawningComponents,
} from '../../src/game/spawning';
import {
  registerShootingComponents,
  installShootingSystems,
} from '../../src/game/shooting';

const DT_MS = 1000 / 60;

vi.mock('@vworlds/vecs-server', () => ({
  NetworkClient: class NetworkClient {
    id = '';
  },
  NetworkInput: class NetworkInput {
    input: unknown;
  },
  Networked: class Networked {},
}));

function createTestWorld(): World {
  const world = new World();
  for (const component of phaserNetworkComponents) world.component(component);
  world.component(Explosion);
  registerPlayerSessionComponents(world as never);
  registerSpawningComponents(world as never);
  registerShootingComponents(world as never);
  registerCombatComponents(world as never);
  world.module(PhysicsModule, {
    gravity: { x: 0, y: 0 },
    fixedTimeStep: 1 / 60,
    subSteps: 4,
  });
  installShootingSystems(world as never);
  installCombatSystems(world as never, createPrng(1234));
  world
    .entity()
    .set(GameStateView, { state: 0, wave: 1, score: 0, status: '' });
  return world;
}

function runFrame(world: World): void {
  world.progress(DT_MS, DT_MS);
}

function count(world: World, component: ComponentClass): number {
  let total = 0;
  world.filter([component]).forEach([], () => {
    total += 1;
  });
  return total;
}

function asteroids(world: World): Entity[] {
  const found: Entity[] = [];
  world.filter([Asteroid]).forEach([], (e) => found.push(e));
  return found;
}

function fireBulletAt(world: World, x: number, y: number): Entity {
  const body = world
    .entity()
    .set(Body, { type: BodyType.Dynamic })
    .set(Position, { x, y })
    .set(PhysicsPosition, { x, y });
  world
    .entity()
    .childOf(body)
    .set(Circle, { radius: 0.02 })
    .add(Sensor)
    .add(SensorEvents)
    .set(CollisionFilter, {
      categoryBits: CAT_PLAYER_BULLET,
      maskBits: CAT_ASTEROID,
    });
  body.add(Bullet);
  return body;
}

describe('split child hittability', () => {
  // Regression for the vecs-physics shape-id recycling bug: a child asteroid
  // spawned from a parent's fragmentation recycles the freed shape-id slot of
  // the destroyed parent/bullet. The parent's deferred shape teardown wrongly
  // deleted the child's entry from entityByShapeIndex, so the child's sensor
  // begin events were dropped and it became un-hittable.
  it('a split-spawned child asteroid can itself be hit and split again', () => {
    const world = createTestWorld();

    // Big parent so both children stay well above MIN_COLLIDABLE_MASS.
    createAsteroid(
      world as never,
      createPrng(1),
      0,
      0,
      ENTITY_CONFIG.ASTEROID.MAX_MASS,
    );

    // First hit at the parent center -> splits into 2 children.
    fireBulletAt(world, 0, 0);
    runFrame(world);

    const children = asteroids(world);
    expect(children.length).toBe(2);

    // Now hit the first child at its own position.
    const child = children[0]!;
    const rp = child.get(Position)!;
    fireBulletAt(world, rp.x, rp.y);
    runFrame(world);

    // The targeted child must have been hit: it is consumed and replaced by its
    // own fragments. If it were un-hittable the bullet would pass through and the
    // child would still be alive.
    expect(world.getEntity(child.eid)).toBeUndefined();
    expect(count(world, Asteroid)).toBeGreaterThan(0);
  });
});
