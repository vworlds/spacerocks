import {
  ChildOf,
  World,
  type ComponentClass,
  type Entity,
} from '@vworlds/vecs';
import { Position } from '@vworlds/vecs-phaser';
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
  CAT_ASTEROID,
  CAT_PLAYER_BULLET,
  Explosion,
  ENTITY_CONFIG,
  NetworkComponentsModule,
} from '@spacerocks/common';
import { describe, expect, it, vi } from 'vitest';
import { registerNetworkFoundation } from '../helpers';
import { CombatModule } from '../../../src/game/modules/combat/module';
import {
  Components as CombatComponents,
  Health,
  RespawnTimer,
} from '../../../src/game/modules/combat/components';
import { createPlayerShip } from '../../../src/game/modules/playerShips/factories';
import { PlayerShip } from '../../../src/game/modules/playerShips/components';
import { PlayerSession } from '../../../src/game/modules/playerSessions/components';
import { PlayerSessionsModule } from '../../../src/game/modules/playerSessions/module';
import { createPrng } from '../../../src/game/modules/rng/components';
import { RngModule } from '../../../src/game/modules/rng/module';
import { GameStateModule } from '../../../src/game/modules/gameState/module';
import { createAsteroid } from '../../../src/game/modules/asteroids/factories';
import {
  Asteroid,
  Components as AsteroidsComponents,
} from '../../../src/game/modules/asteroids/components';
import { createBullet } from '../../../src/game/modules/weapons/factories';
import { Bullet } from '../../../src/game/modules/weapons/components';
import { DecayModule } from '../../../src/game/modules/decay/module';
import { WeaponsModule } from '../../../src/game/modules/weapons/module';

const DT_MS = 1000 / 60;

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

function createTestWorld(): { world: World } {
  const world = new World();
  world.module(NetworkComponentsModule);
  registerNetworkFoundation(world);
  world.component(Explosion);
  world.module(RngModule);
  world.module(CombatComponents);
  world.module(AsteroidsComponents);
  world.module(PhysicsModule, {
    gravity: { x: 0, y: 0 },
    fixedTimeStep: 1 / 60,
    subSteps: 4,
  });
  world.module(GameStateModule);
  world.module(PlayerSessionsModule);
  world.module(WeaponsModule);
  world.module(DecayModule);
  world.module(CombatModule);
  return { world };
}

function runFrame(world: World): void {
  world.progress(DT_MS, DT_MS);
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
  it('splits asteroids and creates explosion markers from collisions', () => {
    const { world } = createTestWorld();
    createAsteroid(world, createPrng(1), 100, 100, ENTITY_CONFIG.ASTEROID.MASS);
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
  });

  it('expires explosion effect entities through server-side decay', () => {
    const { world } = createTestWorld();
    createAsteroid(world, createPrng(1), 100, 100, ENTITY_CONFIG.ASTEROID.MASS);
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

  it('kills and respawns one ship independently without resetting global state', () => {
    const { world } = createTestWorld();
    const session = world.entity().set(PlayerSession, {
      clientId: 'client-a',
      playerIndex: 0,
    });
    const ship = createPlayerShip(world, session, 0);
    ship.set(Position, { x: 30, y: 30 });
    ship.set(PhysicsPosition, { x: 30, y: 30 });
    ship.set(Health, { hp: 10, maxHp: 100 });
    createAsteroid(world, createPrng(2), 30, 30, ENTITY_CONFIG.ASTEROID.MASS);

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
    const ship = createPlayerShip(world, session, 0);
    const bulletA = createBullet(world, ship, 0, 0, 0, 0xffffff);
    const bulletB = createBullet(world, ship, 0, 0, Math.PI, 0xffffff);

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
    const ship = createPlayerShip(world, session, 0);
    ship.set(Position, { x: 0, y: 0 });
    ship.set(PhysicsPosition, { x: 0, y: 0 });
    ship.set(Health, { hp: 100, maxHp: 100 });
    const bullet = createBullet(world, ship, 0, 0, 0, 0xffffff);
    bullet.set(Position, { x: 0, y: 0 });
    bullet.set(PhysicsPosition, { x: 0, y: 0 });

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

  it('splits an asteroid once when two bullets strike it in the same tick', () => {
    const { world } = createTestWorld();
    createAsteroid(world, createPrng(1), 0, 0, ENTITY_CONFIG.ASTEROID.MASS);
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

    // One split yields two fragments; a double-split would yield four. The
    // consumed-set guard must collapse the second hit.
    expect(count(world, Asteroid)).toBe(2);
  });

  it('resolves a sensor contact once per tick despite the enter+modify double fire', () => {
    const { world } = createTestWorld();
    const session = world.entity().set(PlayerSession, {
      clientId: 'client-a',
      playerIndex: 0,
    });
    const ship = createPlayerShip(world, session, 0);
    ship.set(Position, { x: 0, y: 0 });
    ship.set(PhysicsPosition, { x: 0, y: 0 });
    ship.set(Health, { hp: 100, maxHp: 100 });
    createAsteroid(world, createPrng(5), 0, 0, ENTITY_CONFIG.ASTEROID.MASS);

    runFrame(world);

    // The ship sensor entered the query and got events on the same tick, so
    // .update(SensorEvents) fires twice; processedShapes must drain begin once.
    // Two hits would read hp 80 / two explosions.
    expect(ship.get(Health)?.hp).toBe(90);
    expect(count(world, Explosion)).toBe(1);
  });
});
