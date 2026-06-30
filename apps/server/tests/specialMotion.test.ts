import { World, type ComponentClass, type Entity } from '@vworlds/vecs';
import { PhaserServerModule } from '@vworlds/vecs-phaser-server';
import {
  Position as RenderPosition,
  Rotation as RenderRotation,
} from '@vworlds/vecs-phaser';
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
  Alien,
  Asteroid,
  Boomerang,
  BoomerangWeapon,
  Bullet,
  CAT_PLAYER,
  COLORS,
  Decay,
  ENTITY_CONFIG,
  Explosion,
  GameStateView,
  LaserWeapon,
  NetworkComponentsModule,
  PlayerShip,
  perSecond,
  Rocket,
  SCORING,
  TICK_RATE,
  WORLD_MAX_X,
  WORLD_MAX_Y,
  WORLD_MIN_X,
  WORLD_MIN_Y,
  Wraps,
} from '@spacerocks/common';
import { describe, expect, it, vi } from 'vitest';
import { registerNetworkFoundation } from './modules/helpers';
import { CombatModule } from '../src/game/modules/combat/module';
import { Components as CombatComponents } from '../src/game/modules/combat/components';
import { MovementModule } from '../src/game/modules/movement/module';
import { createPlayerShip } from '../src/game/modules/playerSessions/factories';
import { PlayerSession } from '../src/game/modules/playerSessions/components';
import { PlayerSessionsModule } from '../src/game/modules/playerSessions/module';
import { createPrng } from '../src/game/modules/rng/components';
import { RngModule } from '../src/game/modules/rng/module';
import { GameStateModule } from '../src/game/modules/gameState/module';
import { Components as SpawningComponents } from '../src/game/modules/spawning/components';
import { createAlien } from '../src/game/modules/aliens/factories';
import { createAsteroid } from '../src/game/modules/asteroids/factories';
import { Components as AsteroidsComponents } from '../src/game/modules/asteroids/components';
import {
  createBoomerang,
  createBullet,
  createRocket,
} from '../src/game/modules/weapons/factories';
import { Components as WeaponsComponents } from '../src/game/modules/weapons/components';
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
  world.module(MovementModule);
  world.module(CombatModule);
  world.module(PhaserServerModule);
  if (!(options.installShooting ?? true)) {
    world.entity().set(GameStateView, {
      state: 0,
      wave: 1,
      score: 0,
      status: '',
    });
  }
  return world;
}

function createLaserWorld(): World {
  const world = new World();
  world.module(NetworkComponentsModule);
  registerNetworkFoundation(world);
  world.component(Explosion);
  world.module(RngModule);
  world.module(CombatComponents);
  world.module(SpawningComponents);
  world.module(AsteroidsComponents);
  world.module(WeaponsComponents);
  world.module(PhysicsModule, {
    gravity: { x: 0, y: 0 },
    fixedTimeStep: 1 / TICK_RATE,
    subSteps: 4,
  });
  world.module(GameStateModule);
  world.module(PlayerSessionsModule);
  world.module(WeaponsModule);
  world.module(CombatModule);
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

function score(world: World): number {
  let value = 0;
  world.filter([GameStateView]).forEach([GameStateView], (_entity, [state]) => {
    value = state.score;
  });
  return value;
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

  it('homes rockets toward aliens before equal-distance asteroids from overlapCircle candidates', () => {
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

    const alien = createAlien(
      world as unknown as Parameters<typeof createAlien>[0],
      createPrng(2),
    );
    alien.set(PhysicsPosition, { x: 1, y: 1 });
    alien.set(RenderPosition, { x: 1, y: 1 });
    alien.set(LinearVelocity, { x: 0, y: 0 });

    const equalDistanceAsteroid = createAsteroid(
      world as unknown as Parameters<typeof createAsteroid>[0],
      createPrng(3),
      1,
      -1,
      ENTITY_CONFIG.ASTEROID.MASS,
    )!;
    equalDistanceAsteroid.set(LinearVelocity, { x: 0, y: 0 });
    const outsideAsteroid = createAsteroid(
      world as unknown as Parameters<typeof createAsteroid>[0],
      createPrng(4),
      0,
      ENTITY_CONFIG.ROCKET.HOME_RANGE + 1,
      ENTITY_CONFIG.ASTEROID.MASS,
    )!;
    outsideAsteroid.set(LinearVelocity, { x: 0, y: 0 });

    step(world, 5);

    const velocity = rocket.get(LinearVelocity)!;
    expect(count(world, Alien)).toBe(1);
    expect(count(world, Asteroid)).toBe(2);
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

  it('laser raycasts split only asteroids along the beam and score the hit', () => {
    const world = createLaserWorld();
    const ship = world
      .entity()
      .set(PlayerShip, { playerIndex: 0, color: COLORS.white })
      .set(PhysicsPosition, { x: 0, y: 0 })
      .set(PhysicsRotation, { angle: 0 })
      .set(RenderPosition, { x: 0, y: 0 })
      .set(RenderRotation, { angle: 0 })
      .set(LaserWeapon, { shots: 1, firing: false, timer: 10 });
    createAsteroid(
      world as unknown as Parameters<typeof createAsteroid>[0],
      createPrng(2),
      1,
      0,
      ENTITY_CONFIG.ASTEROID.MASS,
    );
    const offBeam = createAsteroid(
      world as unknown as Parameters<typeof createAsteroid>[0],
      createPrng(3),
      1,
      1,
      ENTITY_CONFIG.ASTEROID.MASS,
    )!;
    step(world);
    ship.set(LaserWeapon, { shots: 1, firing: true, timer: 10 });

    step(world);

    expect(world.getEntity(offBeam.eid)).toBe(offBeam);
    expect(count(world, Asteroid)).toBe(3);
    expect(score(world)).toBe(SCORING.ASTEROID_BASE);
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
