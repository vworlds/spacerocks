import {
  ChildOf,
  World,
  type ComponentClass,
  type Entity,
} from '@vworlds/vecs';
import { phaserNetworkComponents, Position } from '@vworlds/vecs-phaser';
import {
  Body,
  BodyType,
  Circle,
  CollisionFilter,
  LinearVelocity,
  PhysicsModule,
  Position as PhysicsPosition,
  Sensor,
  SensorEvents,
} from '@vworlds/vecs-physics';
import {
  Asteroid,
  Alien,
  Bullet,
  CAT_ASTEROID,
  CAT_ENEMY,
  CAT_ENEMY_BULLET,
  CAT_PICKUP,
  CAT_PLAYER,
  CAT_PLAYER_BULLET,
  Explosion,
  ENTITY_CONFIG,
  GameStateView,
  Health,
  HealthPickup,
  LaserWeapon,
  Pickup,
  PickupKind,
  PlayerShip,
  RocketWeapon,
  SCORING,
  Shield,
} from '@spacerocks/common';
import { describe, expect, it, vi } from 'vitest';
import {
  installCombatSystems,
  registerCombatComponents,
  RespawnTimer,
} from '../../src/game/combat';
import {
  createPlayerShip,
  PlayerSession,
  registerPlayerSessionComponents,
} from '../../src/game/playerSessions';
import { createPrng } from '../../src/game/rng';
import {
  createAsteroid,
  createAlien,
  registerSpawningComponents,
} from '../../src/game/spawning';
import {
  createBullet,
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

function createTestWorld(): { world: World } {
  const world = new World();
  for (const component of phaserNetworkComponents) world.component(component);
  world.component(Explosion);
  registerPlayerSessionComponents(
    world as unknown as Parameters<typeof registerPlayerSessionComponents>[0],
  );
  registerSpawningComponents(
    world as unknown as Parameters<typeof registerSpawningComponents>[0],
  );
  registerShootingComponents(
    world as unknown as Parameters<typeof registerShootingComponents>[0],
  );
  registerCombatComponents(
    world as unknown as Parameters<typeof registerCombatComponents>[0],
  );
  world.module(PhysicsModule, {
    gravity: { x: 0, y: 0 },
    fixedTimeStep: 1 / 60,
    subSteps: 4,
  });
  installShootingSystems(
    world as unknown as Parameters<typeof installShootingSystems>[0],
  );
  installCombatSystems(
    world as unknown as Parameters<typeof installCombatSystems>[0],
    createPrng(1234),
  );
  world.entity().set(GameStateView, {
    state: 0,
    wave: 1,
    score: 0,
    status: '',
  });
  return { world };
}

function runFrame(world: World): void {
  world.progress(DT_MS, DT_MS);
}

function moveBody(entity: Entity, x: number, y: number): void {
  entity.set(Position, { x, y });
  entity.set(PhysicsPosition, { x, y });
}

function createSensorBody(
  world: World,
  options: {
    x: number;
    y: number;
    radius: number;
    categoryBits: number;
    maskBits: number;
  },
): Entity {
  const body = world
    .entity()
    .set(Body, { type: BodyType.Dynamic })
    .set(Position, { x: options.x, y: options.y })
    .set(PhysicsPosition, { x: options.x, y: options.y });

  world
    .entity()
    .childOf(body)
    .set(Circle, { radius: options.radius })
    .add(Sensor)
    .add(SensorEvents)
    .set(CollisionFilter, {
      categoryBits: options.categoryBits,
      maskBits: options.maskBits,
    });

  return body;
}

function createTestPickup(
  world: World,
  x: number,
  y: number,
  kind: PickupKind,
): Entity {
  return createSensorBody(world, {
    x,
    y,
    radius: ENTITY_CONFIG.POWERUP.RADIUS,
    categoryBits: CAT_PICKUP,
    maskBits: CAT_PLAYER,
  }).set(Pickup, { kind });
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

describe('server combat systems', () => {
  it('splits asteroids, scores, and creates explosion markers from collisions', () => {
    const { world } = createTestWorld();
    createAsteroid(
      world as unknown as Parameters<typeof createAsteroid>[0],
      createPrng(1),
      100,
      100,
      ENTITY_CONFIG.ASTEROID.MASS,
    );
    createSensorBody(world, {
      x: 100,
      y: 100,
      radius: 0.02,
      categoryBits: CAT_PLAYER_BULLET,
      maskBits: CAT_ASTEROID,
    }).add(Bullet);

    runFrame(world);

    expect(count(world, Asteroid)).toBe(2);
    expect(count(world, Bullet)).toBe(0);
    expect(count(world, Explosion)).toBe(1);
    expect(firstEntity(world, GameStateView).get(GameStateView)?.score).toBe(
      SCORING.ASTEROID_BASE,
    );
  });

  it('expires explosion effect entities through server-side decay', () => {
    const { world } = createTestWorld();
    createAsteroid(
      world as unknown as Parameters<typeof createAsteroid>[0],
      createPrng(1),
      100,
      100,
      ENTITY_CONFIG.ASTEROID.MASS,
    );
    createSensorBody(world, {
      x: 100,
      y: 100,
      radius: 0.02,
      categoryBits: CAT_PLAYER_BULLET,
      maskBits: CAT_ASTEROID,
    }).add(Bullet);

    runFrame(world);
    expect(count(world, Explosion)).toBe(1);
    expect(firstEntity(world, Explosion).get(Explosion)).toMatchObject({
      size: expect.closeTo(
        Math.sqrt(
          ENTITY_CONFIG.ASTEROID.MASS /
            (Math.PI * ENTITY_CONFIG.ASTEROID.DENSITY),
        ),
      ),
      duration: ENTITY_CONFIG.EXPLOSION.LIFE_FRAMES / 30,
    });

    for (let i = 0; i <= ENTITY_CONFIG.EXPLOSION.LIFE_FRAMES; i += 1) {
      runFrame(world);
    }

    expect(count(world, Explosion)).toBe(0);
  });

  it('damages players with enemy bullets', () => {
    const { world } = createTestWorld();
    const session = world.entity().set(PlayerSession, {
      clientId: 'client-a',
      playerIndex: 0,
    });
    const ship = createPlayerShip(
      world as unknown as Parameters<typeof createPlayerShip>[0],
      session,
      0,
    );
    moveBody(ship, 0, 0);
    ship.set(Health, { hp: 100, maxHp: 100, healthBarTimer: 0 });
    const alien = world.entity().add(Alien);
    const bullet = createBullet(
      world as unknown as Parameters<typeof createBullet>[0],
      alien,
      0,
      0,
      0,
      0xffffff,
      'alien',
    );
    moveBody(bullet, 0, 0);

    runFrame(world);

    expect(ship.get(Health)).toMatchObject({
      hp: 90,
      healthBarTimer: ENTITY_CONFIG.SHIP.HEALTH_BAR_TIMER,
    });
    expect(world.getEntity(bullet.eid)).toBeUndefined();
  });

  it('splits asteroids with enemy bullets', () => {
    const { world } = createTestWorld();
    createAsteroid(
      world as unknown as Parameters<typeof createAsteroid>[0],
      createPrng(1),
      0,
      0,
      ENTITY_CONFIG.ASTEROID.MASS,
    );
    const alien = world.entity().add(Alien);
    const bullet = createBullet(
      world as unknown as Parameters<typeof createBullet>[0],
      alien,
      0,
      0,
      0,
      0xffffff,
      'alien',
    );
    const shape = [...bullet.children(ChildOf)].find((child) =>
      child.get(Circle),
    );

    expect(shape?.get(CollisionFilter)).toMatchObject({
      categoryBits: CAT_ENEMY_BULLET,
      maskBits: CAT_ASTEROID | CAT_PLAYER,
    });

    runFrame(world);

    expect(count(world, Asteroid)).toBe(2);
    expect(world.getEntity(bullet.eid)).toBeUndefined();
    expect(count(world, Explosion)).toBe(1);
    expect(firstEntity(world, GameStateView).get(GameStateView)?.score).toBe(
      SCORING.ASTEROID_BASE,
    );
  });

  it('damages and bumps enemies on asteroid contact without destroying the asteroid', () => {
    const { world } = createTestWorld();
    const asteroid = createAsteroid(
      world as unknown as Parameters<typeof createAsteroid>[0],
      createPrng(1),
      -0.35,
      0,
      ENTITY_CONFIG.ASTEROID.MASS,
      { velocity: { x: 2, y: 0 } },
    )!;
    const alien = createAlien(
      world as unknown as Parameters<typeof createAlien>[0],
      createPrng(2),
    );
    moveBody(alien, 0.15, 0);
    alien.set(LinearVelocity, { x: 0, y: 0 });
    alien.set(Health, {
      hp: ENTITY_CONFIG.ALIEN.MAX_HP,
      maxHp: ENTITY_CONFIG.ALIEN.MAX_HP,
      healthBarTimer: 0,
    });

    runFrame(world);

    expect(world.getEntity(asteroid.eid)).toBe(asteroid);
    expect(world.getEntity(alien.eid)).toBe(alien);
    expect(alien.get(Health)).toMatchObject({
      hp: ENTITY_CONFIG.ALIEN.MAX_HP - ENTITY_CONFIG.BULLET.DAMAGE,
      healthBarTimer: ENTITY_CONFIG.SHIP.HEALTH_BAR_TIMER,
    });
    expect(alien.get(LinearVelocity)!.x).toBeGreaterThan(0);
    expect(count(world, Explosion)).toBe(1);
    expect(firstEntity(world, GameStateView).get(GameStateView)?.score).toBe(0);
  });

  it('applies health pickups through server-side handlers', () => {
    const { world } = createTestWorld();
    const session = world.entity().set(PlayerSession, {
      clientId: 'client-a',
      playerIndex: 0,
    });
    const ship = createPlayerShip(
      world as unknown as Parameters<typeof createPlayerShip>[0],
      session,
      0,
    );
    moveBody(ship, 10, 20);
    ship.set(Health, { hp: 50, maxHp: 100, healthBarTimer: 0 });
    createTestPickup(world, 10, 20, PickupKind.Health).set(HealthPickup, {
      amount: 0.5,
    });

    runFrame(world);

    expect(ship.get(Health)).toMatchObject({ hp: 100 });
    expect(ship.get(Health)).toMatchObject({
      hp: 100,
      healthBarTimer: ENTITY_CONFIG.SHIP.HEALTH_BAR_TIMER,
    });
    expect(count(world, Pickup)).toBe(0);
    expect(firstEntity(world, GameStateView).get(GameStateView)?.score).toBe(
      SCORING.HEALTH_LARGE,
    );
  });

  it('applies shield pickups through server-side handlers', () => {
    const { world } = createTestWorld();
    const session = world.entity().set(PlayerSession, {
      clientId: 'client-a',
      playerIndex: 0,
    });
    const ship = createPlayerShip(
      world as unknown as Parameters<typeof createPlayerShip>[0],
      session,
      0,
    );
    moveBody(ship, 10, 20);
    createTestPickup(world, 10, 20, PickupKind.Shield);

    runFrame(world);

    expect(ship.get(Shield)).toMatchObject({
      shieldTime: ENTITY_CONFIG.SHIP.SHIELD_DURATION,
    });
    expect(count(world, Pickup)).toBe(0);
    expect(firstEntity(world, GameStateView).get(GameStateView)?.score).toBe(
      SCORING.SHIELD,
    );
  });

  it('applies weapon pickups through server-side handlers', () => {
    const { world } = createTestWorld();
    const session = world.entity().set(PlayerSession, {
      clientId: 'client-a',
      playerIndex: 0,
    });
    const ship = createPlayerShip(
      world as unknown as Parameters<typeof createPlayerShip>[0],
      session,
      0,
    );
    moveBody(ship, 10, 20);
    createTestPickup(world, 10, 20, PickupKind.Rocket);

    runFrame(world);

    expect(ship.get(RocketWeapon)).toMatchObject({
      shots: ENTITY_CONFIG.ROCKET.SHOT_COUNT,
    });
    expect(ship.get(LaserWeapon)).toBeUndefined();
    expect(count(world, Pickup)).toBe(0);
    expect(firstEntity(world, GameStateView).get(GameStateView)?.score).toBe(
      SCORING.ROCKET,
    );
  });

  it('kills and respawns one ship independently without resetting global state', () => {
    const { world } = createTestWorld();
    const session = world.entity().set(PlayerSession, {
      clientId: 'client-a',
      playerIndex: 0,
    });
    const ship = createPlayerShip(
      world as unknown as Parameters<typeof createPlayerShip>[0],
      session,
      0,
    );
    moveBody(ship, 30, 30);
    ship.set(Health, { hp: 10, maxHp: 100, healthBarTimer: 0 });
    createAsteroid(
      world as unknown as Parameters<typeof createAsteroid>[0],
      createPrng(2),
      30,
      30,
      ENTITY_CONFIG.ASTEROID.MASS,
    );

    runFrame(world);

    expect(world.getEntity(ship.eid)).toBeUndefined();
    const respawnTimer = firstEntity(world, RespawnTimer).get(RespawnTimer);
    expect(respawnTimer).toMatchObject({
      sessionId: session.eid,
      playerIndex: 0,
    });
    expect(
      [...session.children(ChildOf)].filter((e) => e.get(PlayerShip)),
    ).toHaveLength(0);
    expect(firstEntity(world, GameStateView).get(GameStateView)).toMatchObject({
      state: 0,
      wave: 1,
    });

    for (let i = 0; i < 180; i += 1) runFrame(world);

    expect(
      [...session.children(ChildOf)].filter((e) => e.get(PlayerShip)),
    ).toHaveLength(1);
    const respawnedShip = [...session.children(ChildOf)].find((e) =>
      e.get(PlayerShip),
    );
    expect(respawnedShip?.get(Body)).toBeTruthy();
    expect(
      [...(respawnedShip?.children(ChildOf) ?? [])].filter((e) =>
        e.get(Circle),
      ),
    ).toHaveLength(2);
  });

  it('deletes a ship, its owned projectiles, and every physics shape child without orphans', () => {
    const { world } = createTestWorld();
    const session = world.entity().set(PlayerSession, {
      clientId: 'client-a',
      playerIndex: 0,
    });
    const ship = createPlayerShip(
      world as unknown as Parameters<typeof createPlayerShip>[0],
      session,
      0,
    );
    const bulletA = createBullet(
      world as unknown as Parameters<typeof createBullet>[0],
      ship,
      0,
      0,
      0,
      0xffffff,
    );
    const bulletB = createBullet(
      world as unknown as Parameters<typeof createBullet>[0],
      ship,
      0,
      0,
      Math.PI,
      0xffffff,
    );

    runFrame(world);

    expect(count(world, Body)).toBe(3);
    expect(count(world, Circle)).toBe(4);

    ship.destroy();
    world.flush();
    runFrame(world);

    expect(world.getEntity(ship.eid)).toBeUndefined();
    expect(world.getEntity(bulletA.eid)).toBeUndefined();
    expect(world.getEntity(bulletB.eid)).toBeUndefined();
    expect(count(world, Body)).toBe(0);
    expect(count(world, Circle)).toBe(0);
  });

  it('keeps projectiles as owned bodies, not ship fixtures, and filters self-collision', () => {
    const { world } = createTestWorld();
    const session = world.entity().set(PlayerSession, {
      clientId: 'client-a',
      playerIndex: 0,
    });
    const ship = createPlayerShip(
      world as unknown as Parameters<typeof createPlayerShip>[0],
      session,
      0,
    );
    moveBody(ship, 0, 0);
    ship.set(Health, { hp: 100, maxHp: 100, healthBarTimer: 0 });
    const bullet = createBullet(
      world as unknown as Parameters<typeof createBullet>[0],
      ship,
      0,
      0,
      0,
      0xffffff,
    );
    moveBody(bullet, 0, 0);

    runFrame(world);

    expect(
      [...ship.children(ChildOf)].filter((e) => e.get(Circle)),
    ).toHaveLength(2);
    expect([...ship.children(ChildOf)].filter((e) => e.get(Body))).toHaveLength(
      1,
    );

    runFrame(world);

    expect(world.getEntity(bullet.eid)).toBeTruthy();
    expect(ship.get(Health)?.hp).toBe(100);
  });

  it('moves aliens as physics bodies and damages players on sensor collision', () => {
    const { world } = createTestWorld();
    const session = world.entity().set(PlayerSession, {
      clientId: 'client-a',
      playerIndex: 0,
    });
    const ship = createPlayerShip(
      world as unknown as Parameters<typeof createPlayerShip>[0],
      session,
      0,
    );
    moveBody(ship, 0, 0);
    ship.set(Health, { hp: 100, maxHp: 100, healthBarTimer: 0 });
    const alien = createAlien(
      world as unknown as Parameters<typeof createAlien>[0],
      createPrng(9),
    );
    moveBody(alien, 0, 0);
    alien.set(LinearVelocity, { x: 1, y: 0 });

    runFrame(world);

    expect(ship.get(Health)?.hp).toBe(90);
    expect(world.getEntity(alien.eid)).toBeUndefined();
    const driftingAlien = createSensorBody(world, {
      x: -1,
      y: 0,
      radius: ENTITY_CONFIG.ALIEN.RADIUS,
      categoryBits: CAT_ENEMY,
      maskBits: CAT_PLAYER,
    })
      .set(LinearVelocity, { x: 1, y: 0 })
      .add(Alien);

    runFrame(world);

    expect(driftingAlien.get(PhysicsPosition)!.x).toBeGreaterThan(-1);
  });

  it('splits an asteroid once when two bullets strike it in the same tick', () => {
    const { world } = createTestWorld();
    createAsteroid(
      world as unknown as Parameters<typeof createAsteroid>[0],
      createPrng(1),
      0,
      0,
      ENTITY_CONFIG.ASTEROID.MASS,
    );
    for (let i = 0; i < 2; i += 1) {
      createSensorBody(world, {
        x: 0,
        y: 0,
        radius: 0.02,
        categoryBits: CAT_PLAYER_BULLET,
        maskBits: CAT_ASTEROID,
      }).add(Bullet);
    }

    runFrame(world);

    // One split yields two fragments; a double-split would yield four and
    // score twice. The consumed-set guard must collapse the second hit.
    expect(count(world, Asteroid)).toBe(2);
    expect(firstEntity(world, GameStateView).get(GameStateView)?.score).toBe(
      SCORING.ASTEROID_BASE,
    );
  });

  it('scores a bullet-killed alien once even if a player rams it the same tick', () => {
    const { world } = createTestWorld();
    const session = world.entity().set(PlayerSession, {
      clientId: 'client-a',
      playerIndex: 0,
    });
    const ship = createPlayerShip(
      world as unknown as Parameters<typeof createPlayerShip>[0],
      session,
      0,
    );
    moveBody(ship, 0, 0);
    ship.set(Health, { hp: 100, maxHp: 100, healthBarTimer: 0 });

    const alien = createAlien(
      world as unknown as Parameters<typeof createAlien>[0],
      createPrng(3),
    );
    moveBody(alien, 0, 0);
    alien.set(LinearVelocity, { x: 0, y: 0 });
    // One player bullet is lethal so ProjectileImpact destroys the alien.
    alien.set(Health, {
      hp: ENTITY_CONFIG.BULLET.DAMAGE,
      maxHp: ENTITY_CONFIG.ALIEN.MAX_HP,
      healthBarTimer: 0,
    });

    const bullet = createBullet(
      world as unknown as Parameters<typeof createBullet>[0],
      ship,
      0,
      0,
      0,
      0xffffff,
      'player',
    );
    moveBody(bullet, 0, 0);

    runFrame(world);

    expect(world.getEntity(alien.eid)).toBeUndefined();
    expect(world.getEntity(bullet.eid)).toBeUndefined();
    // The kill scores ALIEN exactly once: ProjectileImpact consumes the alien,
    // so the later PlayerContact must skip the already-dead body.
    expect(firstEntity(world, GameStateView).get(GameStateView)?.score).toBe(
      SCORING.ALIEN,
    );
    // The alien died to the bullet before the ram resolved, so the player is
    // untouched (no double-handling across systems).
    expect(ship.get(Health)?.hp).toBe(100);
  });

  it('resolves a sensor contact once per tick despite the enter+modify double fire', () => {
    const { world } = createTestWorld();
    const session = world.entity().set(PlayerSession, {
      clientId: 'client-a',
      playerIndex: 0,
    });
    const ship = createPlayerShip(
      world as unknown as Parameters<typeof createPlayerShip>[0],
      session,
      0,
    );
    moveBody(ship, 0, 0);
    ship.set(Health, { hp: 100, maxHp: 100, healthBarTimer: 0 });
    createAsteroid(
      world as unknown as Parameters<typeof createAsteroid>[0],
      createPrng(5),
      0,
      0,
      ENTITY_CONFIG.ASTEROID.MASS,
    );

    runFrame(world);

    // The ship sensor entered the query and got events on the same tick, so
    // .update(SensorEvents) fires twice; processedShapes must drain begin once.
    // Two hits would read hp 80 / two explosions.
    expect(ship.get(Health)?.hp).toBe(90);
    expect(count(world, Explosion)).toBe(1);
  });
});
