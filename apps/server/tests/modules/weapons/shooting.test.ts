import {
  ChildOf,
  World,
  type ComponentClass,
  type Entity,
} from '@vworlds/vecs';
import {
  FillStyle,
  Line,
  Polygon,
  Rotation as RenderRotation,
  StrokeStyle,
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
  CAT_ENEMY_BULLET,
  CAT_PLAYER,
  COLORS,
  ENTITY_CONFIG,
  NetworkComponentsModule,
  PLAYER_COLORS,
  perSecond,
  Rocket,
  RocketWeapon,
  TICK_RATE,
} from '@spacerocks/common';
import { describe, expect, it, vi } from 'vitest';
import { Networked } from '@vworlds/vecs-server';
import { MovementModule } from '../../../src/game/modules/movement/module';
import { createPlayerShip } from '../../../src/game/modules/playerSessions/factories';
import {
  Components as PlayerSessionsComponents,
  PlayerInputIntent,
} from '../../../src/game/modules/playerSessions/components';
import { PlayerSessionsModule } from '../../../src/game/modules/playerSessions/module';
import {
  createBoomerang,
  createBullet,
  createRocket,
} from '../../../src/game/modules/weapons/factories';
import {
  Components as WeaponsComponents,
  ShootingCooldown,
} from '../../../src/game/modules/weapons/components';
import { WeaponsModule } from '../../../src/game/modules/weapons/module';
import { AliensModule } from '../../../src/game/modules/aliens/module';
import { SpawningModule } from '../../../src/game/modules/spawning/module';
import { RngModule } from '../../../src/game/modules/rng/module';
import { GameStateModule } from '../../../src/game/modules/gameState/module';
import { Components as AsteroidsComponents } from '../../../src/game/modules/asteroids/components';
import { Components as AliensComponents } from '../../../src/game/modules/aliens/components';

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
  world.module(NetworkComponentsModule);
  world.component(Networked);
  world.module(RngModule);
  world.module(GameStateModule);
  world.module(PhysicsModule, {
    gravity: { x: 0, y: 0 },
    fixedTimeStep: 1 / TICK_RATE,
    subSteps: 4,
  });
  world.module(PlayerSessionsComponents);
  world.module(WeaponsComponents);
  world.module(AsteroidsComponents);
  world.module(AliensComponents);
  world.module(PlayerSessionsModule);
  world.module(WeaponsModule);
  world.module(SpawningModule);
  world.module(AliensModule);
  world.module(MovementModule);
  return { world };
}

function createStartedWorldWithShip(): { world: World; ship: Entity } {
  const { world } = createTestWorld();
  const session = world.entity();
  const ship = createPlayerShip(world, session, 0);
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
    const bullet = createBullet(world, ship, 0, 0, 0, COLORS.white);
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
    expect(bullet.get(Line)).toMatchObject({
      x1: 0,
      y1: 0,
      x2: -0.12,
      y2: 0,
    });
    expect(bullet.get(StrokeStyle)).toMatchObject({
      color: PLAYER_COLORS[0],
      alpha: 1,
      width: 2,
    });
    expect(bullet.get(ChildOf)?.target).toBe(ship);
    expect(bullet.get(PhysicsPosition)!.x).toBeGreaterThan(startX);
    expect(ship.get(ShootingCooldown)?.frames).toBeGreaterThan(0);

    world.progress((1000 / 60) * 2, 1000 / 60);

    expect(count(world, Bullet)).toBe(1);
  });

  it('creates enemy bullets from alien cooldown targeting the nearest player', () => {
    const { world, ship } = createStartedWorldWithShip();
    ship.set(PhysicsPosition, { x: 1, y: 0 });
    const alien = world
      .entity()
      .set(Body, { type: BodyType.Dynamic })
      .set(PhysicsPosition, { x: 0, y: 0 })
      .set(PhysicsRotation, { angle: 0 })
      .set(Alien, { shootCooldown: 0 });

    world.progress(0, 1000 / 60);

    expect(count(world, Bullet)).toBe(1);
    const bullet = firstEntity(world, Bullet);
    const shape = [...bullet.children(ChildOf)].find((child) =>
      child.get(Circle),
    );
    expect(bullet.get(Bullet)).toMatchObject({ ownerType: 'alien' });
    expect(bullet.get(ChildOf)?.target).toBe(alien);
    expect(bullet.get(StrokeStyle)).toMatchObject({ color: COLORS.orange });
    expect(shape?.get(CollisionFilter)).toMatchObject({
      categoryBits: CAT_ENEMY_BULLET,
      maskBits: CAT_ASTEROID | CAT_PLAYER,
    });
    expect(bullet.get(LinearVelocity)!.x).toBeGreaterThan(0);
    expect(Math.abs(bullet.get(LinearVelocity)!.y)).toBeLessThan(1e-9);
    expect(alien.get(Alien)?.shootCooldown).toBe(
      ENTITY_CONFIG.ALIEN.SHOOT_COOLDOWN_BASE,
    );
  });

  it('does not fire enemy bullets at players outside alien sight range', () => {
    const { world, ship } = createStartedWorldWithShip();
    ship.set(PhysicsPosition, {
      x: ENTITY_CONFIG.ALIEN.TARGET_DIST_MAX + 0.1,
      y: 0,
    });
    const alien = world
      .entity()
      .set(Body, { type: BodyType.Dynamic })
      .set(PhysicsPosition, { x: 0, y: 0 })
      .set(PhysicsRotation, { angle: 0 })
      .set(Alien, { shootCooldown: 0 });

    world.progress(0, 1000 / 60);

    expect(count(world, Bullet)).toBe(0);
    expect(alien.get(Alien)?.shootCooldown).toBe(0);
  });

  it('rotates aliens toward players before firing enemy bullets', () => {
    const { world, ship } = createStartedWorldWithShip();
    ship.set(PhysicsPosition, { x: 0, y: 1 });
    const alien = world
      .entity()
      .set(Body, { type: BodyType.Dynamic })
      .set(PhysicsPosition, { x: 0, y: 0 })
      .set(PhysicsRotation, { angle: 0 })
      .set(Alien, { shootCooldown: 0 });

    world.progress(0, 1000 / 60);

    expect(count(world, Bullet)).toBe(0);
    expect(alien.get(PhysicsRotation)?.angle).toBeGreaterThan(0);

    // The alien fires once it faces the player (~tick 12). The bullet travels
    // toward the ship and is destroyed on impact, so capture its aim and
    // velocity while it is in flight (before the hit).
    let bulletAngle: number | undefined;
    let bulletVy: number | undefined;
    for (let i = 0; i < 20; i += 1) {
      world.progress((i + 1) * (1000 / TICK_RATE), 1000 / TICK_RATE);
      if (bulletAngle === undefined) {
        world.filter([Bullet]).forEach([], (e) => {
          if (bulletAngle !== undefined) return;
          bulletAngle = e.get(PhysicsRotation)?.angle;
          bulletVy = e.get(LinearVelocity)?.y;
        });
      }
    }

    expect(bulletAngle).toBeDefined();
    expect(bulletAngle!).toBeCloseTo(Math.PI / 2, 1);
    expect(bulletVy!).toBeGreaterThan(0);
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
    const boomerang = createBoomerang(world, ship, 0, 0, 0);

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
    const rocket = createRocket(world, ship, 0, 0, 0);
    const boomerang = createBoomerang(world, ship, 0, 0, 0);

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
