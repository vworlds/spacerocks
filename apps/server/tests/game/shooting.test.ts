import {
  ChildOf,
  World,
  type ComponentClass,
  type Entity,
} from '@vworlds/vecs';
import {
  Alien,
  Arc,
  Asteroid,
  Boomerang,
  BoomerangWeapon,
  Bullet,
  ENTITY_CONFIG,
  Point,
  Position,
  ProjectileView,
  Rocket,
  RocketWeapon,
  Rotation,
  Shape,
  Velocity,
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
  registerPlayerSessionComponents(
    world as unknown as Parameters<typeof registerPlayerSessionComponents>[0],
  );
  registerShootingComponents(
    world as unknown as Parameters<typeof registerShootingComponents>[0],
  );
  world.component(Arc);
  world.component(Alien);
  world.component(Asteroid);
  installShootingSystems(
    world as unknown as Parameters<typeof installShootingSystems>[0],
  );
  installMovementSystems(
    world as unknown as Parameters<typeof installMovementSystems>[0],
  );
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

describe('server shooting systems', () => {
  it('creates owned networked bullets from player shoot input and enforces cooldown', () => {
    const { world, ship } = createStartedWorldWithShip();
    ship.set(PlayerInputIntent, { shoot: true });
    ship.set(Rotation, { angle: 0 });
    const startX = ship.get(Position)!.x;

    world.progress(0, 1000 / 60);
    world.progress(1000 / 60, 1000 / 60);

    expect(count(world, Bullet)).toBe(1);
    const bullet = firstEntity(world, Bullet);
    expect(bullet.get(ProjectileView)).toMatchObject({ kind: 0, team: 0 });
    expect(bullet.get(ChildOf)?.target).toBe(ship);
    expect(bullet.get(Position)!.x).toBeGreaterThan(startX);
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
    rocket.set(Position, { x: 0, y: 0 });
    rocket.set(Velocity, { vx: ENTITY_CONFIG.ROCKET.SPEED, vy: 0 });
    rocket.set(Rotation, { angle: 0 });
    world.entity().set(Position, { x: 100, y: 100 }).add(Asteroid);

    world.progress(1000 / 60, 1000 / 60);

    expect(rocket.get(Rotation)!.angle).toBeGreaterThan(0);
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

    boomerang.set(Position, {
      x: ENTITY_CONFIG.BOOMERANG.ARM_DISTANCE + 10,
      y: 0,
    });
    boomerang.set(Velocity, { vx: 0, vy: 0 });
    ship.set(Position, { x: 0, y: 0 });
    world.progress(0, 1000 / 60);

    expect(boomerang.get(Boomerang)?.armed).toBe(true);

    ship.destroy();
    world.flush();

    expect(world.getEntity(boomerang.eid)).toBeUndefined();
  });

  it('creates wire-encodable projectile shape points', () => {
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

    expect(rocket.get(Shape)?.points).toEqual([
      expect.any(Point),
      expect.any(Point),
      expect.any(Point),
    ]);
    expect(boomerang.get(Shape)?.points).toEqual([
      expect.any(Point),
      expect.any(Point),
      expect.any(Point),
      expect.any(Point),
      expect.any(Point),
      expect.any(Point),
    ]);
  });
});
