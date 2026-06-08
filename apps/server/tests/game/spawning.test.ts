import { World, type ComponentClass, type Entity } from '@vworlds/vecs';
import {
  Alien,
  Asteroid,
  AsteroidView,
  GameStateView,
  Pickup,
  PickupKind,
  PickupView,
  Point,
  Position,
  Shape,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from '@spacerocks/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPrng } from '../../src/game/rng';
import {
  createAlien,
  createAsteroid,
  createPickup,
  installSpawningSystems,
  registerSpawningComponents,
} from '../../src/game/spawning';
import { registerPlayerSessionComponents } from '../../src/game/playerSessions';

vi.mock('@vworlds/vecs-server', () => ({
  NetworkClient: class NetworkClient {
    id = '';
  },
  NetworkInput: class NetworkInput {
    input: unknown;
  },
  Networked: class Networked {},
}));

type ServerWorldLike = Parameters<typeof registerSpawningComponents>[0];

function createTestWorld(seed = 1234): {
  world: World;
} {
  const world = new World();
  registerPlayerSessionComponents(
    world as unknown as Parameters<typeof registerPlayerSessionComponents>[0],
  );
  registerSpawningComponents(world as unknown as ServerWorldLike);
  installSpawningSystems(
    world as unknown as Parameters<typeof installSpawningSystems>[0],
    createPrng(seed),
  );
  return { world };
}

function runSimulation(world: World, now: number): void {
  world.progress(now, 500);
}

function count(world: World, component: ComponentClass): number {
  let total = 0;
  world.filter([component]).forEach([], () => {
    total += 1;
  });
  return total;
}

function firstEntity(
  world: World,
  component: ComponentClass,
): Entity | undefined {
  let value: Entity | undefined;
  world.filter([component]).forEach([], (entity) => {
    value ??= entity;
  });
  return value;
}

describe('server spawning systems', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates one networked GameStateView and the first asteroid wave in fixed world bounds', () => {
    const { world } = createTestWorld();

    expect(firstEntity(world, GameStateView)?.get(GameStateView)).toMatchObject(
      {
        state: 0,
        wave: 1,
        score: 0,
      },
    );
    expect(count(world, GameStateView)).toBe(1);
    expect(count(world, Asteroid)).toBe(5);
    expect(firstEntity(world, Asteroid)?.get(Shape)?.points[0]).toBeInstanceOf(
      Point,
    );

    world
      .filter([Asteroid, Position])
      .forEach([Position], (_entity, [position]) => {
        expect(position.x).toBeGreaterThanOrEqual(0);
        expect(position.x).toBeLessThanOrEqual(WORLD_WIDTH);
        expect(position.y).toBeGreaterThanOrEqual(0);
        expect(position.y).toBeLessThanOrEqual(WORLD_HEIGHT);
      });
  });

  it('creates wire-encodable alien shape points', () => {
    const { world } = createTestWorld();
    const alien = createAlien(
      world as unknown as Parameters<typeof createAlien>[0],
      createPrng(1234),
    );

    expect(alien.get(Shape)?.points).toEqual([
      expect.any(Point),
      expect.any(Point),
      expect.any(Point),
      expect.any(Point),
    ]);
  });

  it('progresses waves when asteroids and aliens are cleared', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const { world } = createTestWorld();
    const asteroids: Entity[] = [];
    const aliens: Entity[] = [];
    world.filter([Asteroid]).forEach([], (entity) => asteroids.push(entity));
    world.filter([Alien]).forEach([], (entity) => aliens.push(entity));
    for (const entity of asteroids) entity.destroy();
    for (const entity of aliens) entity.destroy();

    runSimulation(world, 1000);
    runSimulation(world, 2000);

    expect(firstEntity(world, GameStateView)?.get(GameStateView)).toMatchObject(
      {
        wave: 2,
      },
    );
    expect(count(world, Asteroid)).toBe(7);
  });

  it('does not progress the GameStateView lifecycle while paused', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const { world } = createTestWorld();
    const asteroids: Entity[] = [];
    world.filter([Asteroid]).forEach([], (entity) => asteroids.push(entity));
    for (const entity of asteroids) entity.destroy();
    const gameStateEntity = firstEntity(world, GameStateView);
    if (!gameStateEntity) throw new Error('Expected GameStateView entity');
    gameStateEntity.set(GameStateView, {
      state: 1,
      wave: 1,
      score: 0,
      status: 'Paused',
    });

    runSimulation(world, 1000);
    runSimulation(world, 2000);

    expect(gameStateEntity.get(GameStateView)).toMatchObject({
      state: 1,
      wave: 1,
      status: 'Paused',
    });
    expect(count(world, Asteroid)).toBe(0);
  });

  it('spawns aliens and pickups from server timers while playing', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const { world } = createTestWorld();

    vi.setSystemTime(120_000);
    runSimulation(world, 120_000);

    expect(count(world, Alien)).toBeGreaterThan(0);
    expect(count(world, Pickup)).toBeGreaterThan(0);
  });

  it('pauses timed spawns when GameStateView is not playing', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const { world } = createTestWorld();
    const gameStateEntity = firstEntity(world, GameStateView);
    if (!gameStateEntity) throw new Error('Expected GameStateView entity');
    gameStateEntity.set(GameStateView, {
      state: 1,
      wave: 1,
      score: 0,
      status: '',
    });

    vi.setSystemTime(120_000);
    runSimulation(world, 120_000);

    expect(count(world, Alien)).toBe(0);
    expect(count(world, Pickup)).toBe(0);
  });

  it('uses deterministic server RNG for asteroid and pickup metadata', () => {
    const { world: worldA } = createTestWorld(999);
    const { world: worldB } = createTestWorld(999);
    const rngA = createPrng(42);
    const rngB = createPrng(42);

    const asteroidA = createAsteroid(
      worldA as unknown as Parameters<typeof createAsteroid>[0],
      rngA,
      10,
      20,
      3,
    );
    const asteroidB = createAsteroid(
      worldB as unknown as Parameters<typeof createAsteroid>[0],
      rngB,
      10,
      20,
      3,
    );
    const pickupA = createPickup(
      worldA as unknown as Parameters<typeof createPickup>[0],
      rngA,
      PickupKind.Health,
    );
    const pickupB = createPickup(
      worldB as unknown as Parameters<typeof createPickup>[0],
      rngB,
      PickupKind.Health,
    );

    expect(asteroidA.get(AsteroidView)).toEqual(asteroidB.get(AsteroidView));
    expect(pickupA.get(PickupView)).toEqual(pickupB.get(PickupView));
    expect(pickupA.get(Position)).toEqual(pickupB.get(Position));
  });
});
