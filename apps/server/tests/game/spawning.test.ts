import { World, type ComponentClass, type Entity } from '@vworlds/vecs';
import {
  Alien,
  Asteroid,
  AsteroidView,
  GameStateView,
  Pickup,
  PickupKind,
  PickupView,
  Position,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from '@spacerocks/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPrng } from '../../src/game/rng';
import {
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
type Phase = ReturnType<World['addPhase']>;

function createTestWorld(seed = 1234): {
  world: World;
  simulationPhase: Phase;
} {
  const world = new World();
  const simulationPhase = world.addPhase('simulation');
  registerPlayerSessionComponents(
    world as unknown as Parameters<typeof registerPlayerSessionComponents>[0],
  );
  registerSpawningComponents(world as unknown as ServerWorldLike);
  installSpawningSystems(
    world as unknown as Parameters<typeof installSpawningSystems>[0],
    simulationPhase,
    createPrng(seed),
  );
  world.start();
  return { world, simulationPhase };
}

function runSimulation(
  world: World,
  simulationPhase: Phase,
  now: number,
): void {
  world.beginFrame(500);
  world.runPhase(simulationPhase, now, 500);
  world.endFrame();
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

  it('initializes game state and the first asteroid wave in fixed world bounds', () => {
    const { world } = createTestWorld();

    expect(firstEntity(world, GameStateView)?.get(GameStateView)).toMatchObject(
      {
        state: 0,
        wave: 1,
        score: 0,
      },
    );
    expect(count(world, Asteroid)).toBe(5);

    world
      .filter([Asteroid, Position])
      .forEach([Position], (_entity, [position]) => {
        expect(position.x).toBeGreaterThanOrEqual(0);
        expect(position.x).toBeLessThanOrEqual(WORLD_WIDTH);
        expect(position.y).toBeGreaterThanOrEqual(0);
        expect(position.y).toBeLessThanOrEqual(WORLD_HEIGHT);
      });
  });

  it('progresses waves when asteroids and aliens are cleared', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const { world, simulationPhase } = createTestWorld();
    const asteroids: Entity[] = [];
    const aliens: Entity[] = [];
    world.filter([Asteroid]).forEach([], (entity) => asteroids.push(entity));
    world.filter([Alien]).forEach([], (entity) => aliens.push(entity));
    for (const entity of asteroids) entity.destroy();
    for (const entity of aliens) entity.destroy();

    runSimulation(world, simulationPhase, 1000);
    runSimulation(world, simulationPhase, 2000);

    expect(firstEntity(world, GameStateView)?.get(GameStateView)).toMatchObject(
      {
        wave: 2,
      },
    );
    expect(count(world, Asteroid)).toBe(7);
  });

  it('spawns aliens and pickups from server timers while playing', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const { world, simulationPhase } = createTestWorld();

    vi.setSystemTime(120_000);
    runSimulation(world, simulationPhase, 120_000);

    expect(count(world, Alien)).toBeGreaterThan(0);
    expect(count(world, Pickup)).toBeGreaterThan(0);
  });

  it('pauses timed spawns when GameStateView is not playing', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const { world, simulationPhase } = createTestWorld();
    const gameStateEntity = firstEntity(world, GameStateView);
    if (!gameStateEntity) throw new Error('Expected GameStateView entity');
    gameStateEntity.set(GameStateView, {
      state: 1,
      wave: 1,
      score: 0,
      status: '',
    });

    vi.setSystemTime(120_000);
    runSimulation(world, simulationPhase, 120_000);

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
