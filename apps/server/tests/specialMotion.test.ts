import { World, type ComponentClass, type Entity } from '@vworlds/vecs';
import { PhaserServerModule } from '@vworlds/vecs-phaser-server';
import { Position as RenderPosition } from '@vworlds/vecs-phaser';
import {
  Body,
  BodyType,
  Circle,
  CollisionFilter,
  LinearVelocity,
  PhysicsModule,
  Position as PhysicsPosition,
  Rotation as PhysicsRotation,
  Sensor,
  SensorEvents,
} from '@vworlds/vecs-physics';
import {
  CAT_PLAYER,
  COLORS,
  ENTITY_CONFIG,
  Explosion,
  NetworkComponentsModule,
  perSecond,
  TICK_RATE,
  WORLD_MAX_X,
  WORLD_MAX_Y,
  WORLD_MIN_X,
  WORLD_MIN_Y,
} from '@spacerocks/common';
import { describe, expect, it, vi } from 'vitest';
import { registerNetworkFoundation } from './modules/helpers';
import { CombatModule } from '../src/game/modules/combat/module';
import { Components as CombatComponents } from '../src/game/modules/combat/components';
import { MovementModule } from '../src/game/modules/movement/module';
import { Wraps } from '../src/game/modules/movement/components';
import { createPlayerShip } from '../src/game/modules/playerShips/factories';
import { PlayerSession } from '../src/game/modules/playerSessions/components';
import { PlayerSessionsModule } from '../src/game/modules/playerSessions/module';
import { createPrng } from '../src/game/modules/rng/components';
import { RngModule } from '../src/game/modules/rng/module';
import { GameStateModule } from '../src/game/modules/gameState/module';
import { GameStateView } from '../src/game/modules/gameState/components';
import { Components as SpawningComponents } from '../src/game/modules/spawning/components';
import { createAsteroid } from '../src/game/modules/asteroids/factories';
import { Components as AsteroidsComponents } from '../src/game/modules/asteroids/components';
import { Decay } from '../src/game/modules/decay/components';
import { DecayModule } from '../src/game/modules/decay/module';
import {
  createBoomerang,
  createBullet,
  createRocket,
} from '../src/game/modules/weapons/factories';
import {
  Boomerang,
  BoomerangWeapon,
  Bullet,
  Components as WeaponsComponents,
  Rocket,
} from '../src/game/modules/weapons/components';
import { WeaponsModule } from '../src/game/modules/weapons/module';

const DT_MS = 1000 / TICK_RATE;

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
}));

function createSpecialMotionWorld(
  options: { installShooting?: boolean } = {},
): World {
  const world = new World();
  world.module(NetworkComponentsModule);
  registerNetworkFoundation(world);
  world.component(Explosion);
  world.module(RngModule);
  world.module(PhysicsModule, {
    gravity: { x: 0, y: 0 },
    fixedTimeStep: 1 / TICK_RATE,
    subSteps: 4,
  });
  world.module(CombatComponents);
  world.module(SpawningComponents);
  world.module(AsteroidsComponents);
  world.module(WeaponsComponents);
  if (options.installShooting ?? true) {
    world.module(GameStateModule);
    world.module(PlayerSessionsModule);
    world.module(WeaponsModule);
  }
  world.module(DecayModule);
  world.module(MovementModule);
  world.module(CombatModule);
  world.module(PhaserServerModule);
  if (!(options.installShooting ?? true)) {
    world.entity().set(GameStateView, {
      state: 0,
    });
  }
  return world;
}

function createSession(world: World): Entity {
  return world.entity().set(PlayerSession, {
    clientId: 'client-a',
    playerIndex: 0,
  });
}

function createShip(world: World): Entity {
  return createPlayerShip(
    world as unknown as Parameters<typeof createPlayerShip>[0],
    createSession(world),
    0,
  );
}

function createWrappingBody(world: World, x: number, y: number): Entity {
  const body = world
    .entity()
    .set(Body, { type: BodyType.Dynamic })
    .set(PhysicsPosition, { x, y })
    .set(RenderPosition, { x, y })
    .set(LinearVelocity, { x: 0, y: 0 })
    .add(Wraps);

  world
    .entity()
    .childOf(body)
    .set(Circle, { radius: 0.1 })
    .add(Sensor)
    .add(SensorEvents)
    .set(CollisionFilter, { categoryBits: CAT_PLAYER, maskBits: CAT_PLAYER });

  return body;
}

function step(world: World, frames = 1): void {
  for (let i = 0; i < frames; i += 1) {
    world.progress((i + 1) * DT_MS, DT_MS);
  }
}

function distance(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function angleBetween(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dot = a.x * b.x + a.y * b.y;
  const len = Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y);
  return Math.acos(Math.max(-1, Math.min(1, dot / len)));
}

function count(world: World, component: ComponentClass): number {
  let total = 0;
  world.filter([component]).forEach([], () => {
    total += 1;
  });
  return total;
}

describe('special motion under physics', () => {
  it('wraps physics bodies on both axes and syncs render position', () => {
    const world = createSpecialMotionWorld();
    const wrapX = createWrappingBody(world, WORLD_MAX_X + 0.1, 0);
    const wrapY = createWrappingBody(world, 0, WORLD_MIN_Y - 0.1);

    step(world);

    expect(wrapX.get(PhysicsPosition)?.x).toBeCloseTo(WORLD_MIN_X);
    expect(wrapX.get(RenderPosition)?.x).toBeCloseTo(WORLD_MIN_X);
    expect(wrapY.get(PhysicsPosition)?.y).toBeCloseTo(WORLD_MAX_Y);
    expect(wrapY.get(RenderPosition)?.y).toBeCloseTo(WORLD_MAX_Y);
  });

  it('turns rockets toward nearby targets and syncs physics rotation to velocity', () => {
    const world = createSpecialMotionWorld();
    const ship = createShip(world);
    const rocket = createRocket(
      world as unknown as Parameters<typeof createRocket>[0],
      ship,
      0,
      0,
      0,
    );
    rocket.set(Rocket, { straightTimer: 0 });
    rocket.set(PhysicsPosition, { x: 0, y: 0 });
    rocket.set(RenderPosition, { x: 0, y: 0 });
    rocket.set(LinearVelocity, {
      x: perSecond(ENTITY_CONFIG.ROCKET.SPEED),
      y: 0,
    });
    rocket.set(PhysicsRotation, { angle: 0 });
    createAsteroid(
      world as unknown as Parameters<typeof createAsteroid>[0],
      createPrng(1),
      1,
      1,
      ENTITY_CONFIG.ASTEROID.MASS,
    );

    const targetDirection = { x: 1, y: 1 };
    const initialAngle = angleBetween(
      rocket.get(LinearVelocity)!,
      targetDirection,
    );
    step(world, 5);
    const velocity = rocket.get(LinearVelocity)!;
    const finalAngle = angleBetween(velocity, targetDirection);

    expect(finalAngle).toBeLessThan(initialAngle);
    expect(velocity.y).toBeGreaterThan(0);
    expect(rocket.get(PhysicsRotation)?.angle).toBeCloseTo(
      Math.atan2(velocity.y, velocity.x),
    );
  });

  it('pulls armed boomerangs back toward owners and clamps speed', () => {
    const world = createSpecialMotionWorld();
    const ship = createShip(world);
    ship.set(PhysicsPosition, { x: 0, y: 0 });
    ship.set(RenderPosition, { x: 0, y: 0 });
    ship.set(BoomerangWeapon, { shots: 1, inFlight: 0 });
    const boomerang = createBoomerang(
      world as unknown as Parameters<typeof createBoomerang>[0],
      ship,
      0,
      0,
      0,
    );
    boomerang.set(Boomerang, { ownerId: ship.eid, armed: true });
    boomerang.set(PhysicsPosition, { x: 1.5, y: 0 });
    boomerang.set(RenderPosition, { x: 1.5, y: 0 });
    boomerang.set(LinearVelocity, { x: -10, y: 0 });

    const initialDistance = distance(
      boomerang.get(PhysicsPosition)!,
      ship.get(PhysicsPosition)!,
    );
    step(world);
    const finalDistance = distance(
      boomerang.get(PhysicsPosition)!,
      ship.get(PhysicsPosition)!,
    );
    const velocity = boomerang.get(LinearVelocity)!;

    expect(finalDistance).toBeLessThan(initialDistance);
    expect(Math.hypot(velocity.x, velocity.y)).toBeLessThanOrEqual(
      perSecond(ENTITY_CONFIG.BOOMERANG.MAX_SPEED) + 1e-6,
    );
  });

  it('catches armed boomerangs through sensor collision events', () => {
    const world = createSpecialMotionWorld();
    const ship = createShip(world);
    ship.set(PhysicsPosition, { x: 0, y: 0 });
    ship.set(RenderPosition, { x: 0, y: 0 });
    ship.set(BoomerangWeapon, { shots: 0, inFlight: 0 });
    const boomerang = createBoomerang(
      world as unknown as Parameters<typeof createBoomerang>[0],
      ship,
      0,
      0,
      0,
    );
    boomerang.set(Boomerang, { ownerId: ship.eid, armed: true });
    boomerang.set(PhysicsPosition, { x: 0, y: 0 });
    boomerang.set(RenderPosition, { x: 0, y: 0 });
    boomerang.set(LinearVelocity, { x: 0, y: 0 });

    step(world);

    expect(ship.get(BoomerangWeapon)?.shots).toBe(1);
    expect(world.getEntity(boomerang.eid)).toBeUndefined();
  });

  it('expires projectile decay and destroys the entity', () => {
    const world = createSpecialMotionWorld();
    const ship = createShip(world);
    const bullet = createBullet(
      world as unknown as Parameters<typeof createBullet>[0],
      ship,
      0,
      0,
      0,
      COLORS.white,
    );
    bullet.set(Decay, { life: 1, decay: 0.5 });

    step(world, 2);

    expect(world.getEntity(bullet.eid)).toBeUndefined();
    expect(count(world, Bullet)).toBe(0);
  });
});
