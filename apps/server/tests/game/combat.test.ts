import {
  ChildOf,
  World,
  type ComponentClass,
  type Entity,
} from '@vworlds/vecs';
import {
  Asteroid,
  Bullet,
  CAT_ASTEROID,
  CAT_PICKUP,
  CAT_PLAYER,
  CAT_PLAYER_BULLET,
  Collider,
  ENTITY_CONFIG,
  ExplosionView,
  GameStateView,
  Health,
  HealthPickup,
  HealthView,
  Pickup,
  PickupKind,
  PlayerShip,
  Position,
  SCORING,
} from '@spacerocks/common';
import { describe, expect, it, vi } from 'vitest';
import {
  installCombatSystems,
  registerCombatComponents,
} from '../../src/game/combat';
import {
  createPlayerShip,
  PlayerSession,
  registerPlayerSessionComponents,
} from '../../src/game/playerSessions';
import { createPrng } from '../../src/game/rng';
import {
  createAsteroid,
  registerSpawningComponents,
} from '../../src/game/spawning';

vi.mock('@vworlds/vecs-server', () => ({
  NetworkClient: class NetworkClient {
    id = '';
  },
  NetworkInput: class NetworkInput {
    input: unknown;
  },
  Networked: class Networked {},
}));

type Phase = ReturnType<World['addPhase']>;

function createTestWorld(): { world: World; simulationPhase: Phase } {
  const world = new World();
  const simulationPhase = world.addPhase('simulation');
  registerPlayerSessionComponents(
    world as unknown as Parameters<typeof registerPlayerSessionComponents>[0],
  );
  registerSpawningComponents(
    world as unknown as Parameters<typeof registerSpawningComponents>[0],
  );
  registerCombatComponents(
    world as unknown as Parameters<typeof registerCombatComponents>[0],
  );
  world.component(Bullet);
  installCombatSystems(
    world as unknown as Parameters<typeof installCombatSystems>[0],
    simulationPhase,
    createPrng(1234),
  );
  world.entity().set(GameStateView, {
    state: 0,
    wave: 1,
    score: 0,
    status: '',
  });
  world.start();
  return { world, simulationPhase };
}

function runFrame(world: World, simulationPhase: Phase): void {
  world.beginFrame(1000 / 60);
  world.runPhase(simulationPhase, 1000 / 60, 1000 / 60);
  world.endFrame();
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
    const { world, simulationPhase } = createTestWorld();
    createAsteroid(
      world as unknown as Parameters<typeof createAsteroid>[0],
      createPrng(1),
      100,
      100,
      3,
    );
    world.entity().set(Position, { x: 100, y: 100 }).add(Bullet).set(Collider, {
      radius: 2,
      category: CAT_PLAYER_BULLET,
      mask: CAT_ASTEROID,
    });

    runFrame(world, simulationPhase);

    expect(count(world, Asteroid)).toBe(2);
    expect(count(world, Bullet)).toBe(0);
    expect(count(world, ExplosionView)).toBe(1);
    expect(firstEntity(world, GameStateView).get(GameStateView)?.score).toBe(
      SCORING.ASTEROID_BASE * 3,
    );
  });

  it('applies health pickups with server-side handlers and syncs health view', () => {
    const { world, simulationPhase } = createTestWorld();
    const session = world.entity().set(PlayerSession, {
      clientId: 'client-a',
      playerIndex: 0,
    });
    const ship = createPlayerShip(
      world as unknown as Parameters<typeof createPlayerShip>[0],
      session,
      0,
    );
    ship.set(Position, { x: 10, y: 20 });
    ship.set(Health, { hp: 50, maxHp: 100, healthBarTimer: 0 });
    world
      .entity()
      .set(Position, { x: 10, y: 20 })
      .set(Pickup, { kind: PickupKind.Health })
      .set(HealthPickup, { amount: 0.5 })
      .set(Collider, {
        radius: ENTITY_CONFIG.POWERUP.RADIUS,
        category: CAT_PICKUP,
        mask: CAT_PLAYER,
      });

    runFrame(world, simulationPhase);

    expect(ship.get(Health)).toMatchObject({ hp: 100 });
    expect(ship.get(HealthView)).toMatchObject({ hp: 100, barTimer: 60 });
    expect(count(world, Pickup)).toBe(0);
    expect(firstEntity(world, GameStateView).get(GameStateView)?.score).toBe(
      SCORING.HEALTH_LARGE,
    );
  });

  it('kills and respawns one ship independently without resetting global state', () => {
    const { world, simulationPhase } = createTestWorld();
    const session = world.entity().set(PlayerSession, {
      clientId: 'client-a',
      playerIndex: 0,
    });
    const ship = createPlayerShip(
      world as unknown as Parameters<typeof createPlayerShip>[0],
      session,
      0,
    );
    ship.set(Position, { x: 30, y: 30 });
    ship.set(Health, { hp: 10, maxHp: 100, healthBarTimer: 0 });
    createAsteroid(
      world as unknown as Parameters<typeof createAsteroid>[0],
      createPrng(2),
      30,
      30,
      1,
    );

    runFrame(world, simulationPhase);

    expect(world.getEntity(ship.eid)).toBeUndefined();
    expect(
      [...session.children(ChildOf)].filter((e) => e.get(PlayerShip)),
    ).toHaveLength(0);
    expect(firstEntity(world, GameStateView).get(GameStateView)).toMatchObject({
      state: 0,
      wave: 1,
    });

    for (let i = 0; i < 180; i += 1) runFrame(world, simulationPhase);

    expect(
      [...session.children(ChildOf)].filter((e) => e.get(PlayerShip)),
    ).toHaveLength(1);
  });
});
