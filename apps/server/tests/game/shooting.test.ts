import {
  ChildOf,
  World,
  type ComponentClass,
  type Entity,
} from '@vworlds/vecs';
import {
  Arc,
  FillStyle,
  phaserNetworkComponents,
  Polygon,
  Rotation as RenderRotation,
  Triangle,
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
  CAT_ASTEROID,
  COLORS,
  ENTITY_CONFIG,
  PLAYER_COLORS,
  perSecond,
  Rocket,
  RocketWeapon,
  TICK_RATE,
} from '@spacerocks/common';
import { describe, expect, it, vi } from 'vitest';
import { installMovementSystems } from '../../src/game/movement';
import {
  createPlayerShip,
  PlayerInputIntent,
  registerPlayerSessionComponents,
} from '../../src/game/playerSessions';
import {
  createBoomerang,
  createBullet,
  createRocket,
  installShootingSystems,
  registerShootingComponents,
  ShootingCooldown,
} from '../../src/game/shooting';

vi.mock('@vworlds/vecs-server', () => ({
  NetworkClient: class NetworkClient {
    id = '';
  },
  NetworkInput: class NetworkInput {
    input: unknown;
  },
  Networked: class Networked {},
}));

function createTestWorld(): { world: World } {
  const world = new World();
  for (const component of phaserNetworkComponents) world.component(component);
  registerPlayerSessionComponents(
    world as unknown as Parameters<typeof registerPlayerSessionComponents>[0],
  );
  registerShootingComponents(
    world as unknown as Parameters<typeof registerShootingComponents>[0],
  );
  world.component(Alien);
  world.component(Asteroid);
  installShootingSystems(
    world as unknown as Parameters<typeof installShootingSystems>[0],
  );
  installMovementSystems(
    world as unknown as Parameters<typeof installMovementSystems>[0],
  );
  world.module(PhysicsModule, {
    gravity: { x: 0, y: 0 },
    fixedTimeStep: 1 / TICK_RATE,
    subSteps: 4,
  });
  return { world };
}

function createStartedWorldWithShip(): { world: World; ship: Entity } {
  const { world } = createTestWorld();
  const session = world.entity();
  const ship = createPlayerShip(
    world as unknown as Parameters<typeof createPlayerShip>[0],
    session,
    0,
  );
  return { world, ship };
}

function count(world: World, component: ComponentClass): number {
  let total = 0;
  world.filter([component]).forEach([], () => {
    total += 1;
  });
  return total;
}

function firstEntity(world: World, component: ComponentClass): Entity {
  let found: Entity | undefined;
  world.filter([component]).forEach([], (entity) => {
    found ??= entity;
  });
  if (!found) throw new Error(`Expected ${component.name} entity`);
  return found;
}

function stepTicks(world: World, ticks: number): void {
  for (let tick = 0; tick < ticks; tick += 1) {
    world.progress(tick * (1000 / TICK_RATE), 1000 / TICK_RATE);
  }
}

describe('server shooting systems', () => {
  it('creates bullets with per-second physics speed and integrates real distance', () => {
    const { world, ship } = createStartedWorldWithShip();
    const bullet = createBullet(
      world as unknown as Parameters<typeof createBullet>[0],
      ship,
      0,
      0,
      0,
      COLORS.white,
    );
    const expectedSpeed = perSecond(ENTITY_CONFIG.BULLET.SPEED);

    const velocity = bullet.get(LinearVelocity)!;
    expect(Math.hypot(velocity.x, velocity.y)).toBeCloseTo(expectedSpeed, 6);

    stepTicks(world, TICK_RATE);

    expect(bullet.get(PhysicsPosition)!.x).toBeCloseTo(expectedSpeed, 1);
  });

  it('creates owned networked bullets from player shoot input and enforces cooldown', () => {
    const { world, ship } = createStartedWorldWithShip();
    ship.set(PlayerInputIntent, { shoot: true });
    ship.set(RenderRotation, { angle: 0 });
    const startX = ship.get(PhysicsPosition)!.x;

    world.progress(0, 1000 / 60);
    world.progress(1000 / 60, 1000 / 60);

    expect(count(world, Bullet)).toBe(1);
    const bullet = firstEntity(world, Bullet);
    expect(bullet.get(Arc)).toMatchObject({ radius: 0.02 });
    expect(bullet.get(FillStyle)).toMatchObject({
      color: PLAYER_COLORS[0],
      alpha: 1,
    });
    expect(bullet.get(ChildOf)?.target).toBe(ship);
    expect(bullet.get(PhysicsPosition)!.x).toBeGreaterThan(startX);
    expect(ship.get(ShootingCooldown)?.frames).toBeGreaterThan(0);

    world.progress((1000 / 60) * 2, 1000 / 60);

    expect(count(world, Bullet)).toBe(1);
  });

  it('creates rockets from server-owned ammo and homes after the straight timer', () => {
    const { world, ship } = createStartedWorldWithShip();
    ship.set(PlayerInputIntent, { shoot: true });
    ship.set(RocketWeapon, { shots: 2 });

    world.progress(0, 1000 / 60);
    world.progress(1000 / 60, 1000 / 60);

    expect(count(world, Rocket)).toBe(1);
    expect(ship.get(RocketWeapon)?.shots).toBe(1);
    const rocket = firstEntity(world, Rocket);
    rocket.set(Rocket, { straightTimer: 0 });
    rocket.set(PhysicsPosition, { x: 0, y: 0 });
    rocket.set(LinearVelocity, {
      x: perSecond(ENTITY_CONFIG.ROCKET.SPEED),
      y: 0,
    });
    rocket.set(PhysicsRotation, { angle: 0 });
    const asteroid = world
      .entity()
      .set(Body, { type: BodyType.Dynamic })
      .set(PhysicsPosition, { x: 1, y: 1 })
      .set(LinearVelocity, { x: 0, y: 0 })
      .add(Asteroid);
    world
      .entity()
      .childOf(asteroid)
      .set(Circle, { radius: 0.1 })
      .add(Sensor)
      .add(SensorEvents)
      .set(CollisionFilter, {
        categoryBits: CAT_ASTEROID,
        maskBits: CAT_ASTEROID,
      });

    stepTicks(world, 5);

    expect(rocket.get(PhysicsRotation)!.angle).toBeGreaterThan(0);
    expect(rocket.get(LinearVelocity)!.y).toBeGreaterThan(0);
  });

  it('tracks boomerang ammo, in-flight state, arming, and owner cleanup', () => {
    const { world, ship } = createStartedWorldWithShip();
    ship.set(BoomerangWeapon, { shots: 1, inFlight: 0 });
    const boomerang = createBoomerang(
      world as unknown as Parameters<typeof createBoomerang>[0],
      ship,
      0,
      0,
      0,
    );

    expect(ship.get(BoomerangWeapon)).toMatchObject({ shots: 1, inFlight: 1 });
    expect(boomerang.get(ChildOf)?.target).toBe(ship);

    boomerang.set(PhysicsPosition, {
      x: ENTITY_CONFIG.BOOMERANG.ARM_DISTANCE + 0.1,
      y: 0,
    });
    boomerang.set(LinearVelocity, { x: 0, y: 0 });
    ship.set(PhysicsPosition, { x: 0, y: 0 });
    world.progress(0, 1000 / 60);

    expect(boomerang.get(Boomerang)?.armed).toBe(true);

    ship.destroy();
    world.flush();

    expect(world.getEntity(boomerang.eid)).toBeUndefined();
  });

  it('creates phaser projectile render components', () => {
    const { world, ship } = createStartedWorldWithShip();
    const rocket = createRocket(
      world as unknown as Parameters<typeof createRocket>[0],
      ship,
      0,
      0,
      0,
    );
    const boomerang = createBoomerang(
      world as unknown as Parameters<typeof createBoomerang>[0],
      ship,
      0,
      0,
      0,
    );

    expect(rocket.get(Triangle)).toMatchObject({
      x1: 0.06,
      y1: 0,
      x2: -0.03,
      y2: 0.03,
      x3: -0.03,
      y3: -0.03,
    });
    expect(rocket.get(FillStyle)).toMatchObject({
      color: COLORS.rocket,
      alpha: 1,
    });
    expect(boomerang.get(Polygon)?.points).toEqual([
      0, 0, 0.02, 0.05, 0.05, 0.05, 0.03, 0, 0.05, -0.05, 0.02, -0.05,
    ]);
    expect(boomerang.get(FillStyle)).toMatchObject({
      color: COLORS.boomerang,
      alpha: 1,
    });
  });
});
