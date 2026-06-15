import {
  ChildOf,
  World,
  type ComponentClass,
  type Entity,
} from '@vworlds/vecs';
import {
  Arc,
  phaserNetworkComponents,
  Polygon,
  Position,
  StrokeStyle,
} from '@vworlds/vecs-phaser';
import {
  Circle,
  CollisionFilter,
  LinearVelocity,
  PhysicsModule,
  Position as PhysicsPosition,
} from '@vworlds/vecs-physics';
import {
  Alien,
  Asteroid,
  AsteroidView,
  CAT_ASTEROID,
  COLORS,
  ENTITY_CONFIG,
  GameStateView,
  PlayerShip,
  Pickup,
  PICKUP_COLORS,
  PickupKind,
  TICK_RATE,
  VIEWPORT_WIDTH,
  WAVE_ASTEROID_SCALE,
  WORLD_MAX_X,
  WORLD_MAX_Y,
  WORLD_MIN_X,
  WORLD_MIN_Y,
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
import type { Prng } from '../../src/game/rng';

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
  for (const component of phaserNetworkComponents) world.component(component);
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

function createPhysicsSpawnWorld(): World {
  const world = new World();
  for (const component of phaserNetworkComponents) world.component(component);
  registerPlayerSessionComponents(
    world as unknown as Parameters<typeof registerPlayerSessionComponents>[0],
  );
  registerSpawningComponents(world as unknown as ServerWorldLike);
  world.module(PhysicsModule, {
    gravity: { x: 0, y: 0 },
    fixedTimeStep: 1 / TICK_RATE,
    subSteps: 4,
  });
  return world;
}

function runSimulation(world: World, now: number): void {
  world.progress(now, 500);
}

function stepTicks(world: World, ticks: number): void {
  for (let tick = 0; tick < ticks; tick += 1) {
    world.progress(tick * (1000 / TICK_RATE), 1000 / TICK_RATE);
  }
}

function count(world: World, component: ComponentClass): number {
  let total = 0;
  world.filter([component]).forEach([], () => {
    total += 1;
  });
  return total;
}

function fixedAngleRng(angle: number): Prng {
  return {
    next: () => 0,
    int: () => 0,
    bool: () => false,
    range: (min: number, max: number) => {
      if (min === 0 && max === Math.PI * 2) return angle;
      return (min + max) / 2;
    },
  };
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
    expect(count(world, Asteroid)).toBe(5 * WAVE_ASTEROID_SCALE);
    expect(
      firstEntity(world, Asteroid)?.get(Polygon)?.points.length,
    ).toBeGreaterThan(0);

    world
      .filter([Asteroid, Position])
      .forEach([Position], (_entity, [position]) => {
        expect(position.x).toBeGreaterThanOrEqual(WORLD_MIN_X);
        expect(position.x).toBeLessThanOrEqual(WORLD_MAX_X);
        expect(position.y).toBeGreaterThanOrEqual(WORLD_MIN_Y);
        expect(position.y).toBeLessThanOrEqual(WORLD_MAX_Y);
      });
  });

  it('spawns asteroids with measurable per-second physics drift', () => {
    const { world } = createTestWorld();
    world.module(PhysicsModule, {
      gravity: { x: 0, y: 0 },
      fixedTimeStep: 1 / TICK_RATE,
      subSteps: 4,
    });
    const rng = {
      bool: () => false,
      int: () => 0,
      range: () => 0.5,
    } as unknown as Prng;
    const asteroid = createAsteroid(
      world as unknown as Parameters<typeof createAsteroid>[0],
      rng,
      0,
      0,
      ENTITY_CONFIG.ASTEROID.MASS,
    )!;

    expect(
      Math.hypot(
        asteroid.get(LinearVelocity)!.x,
        asteroid.get(LinearVelocity)!.y,
      ),
    ).toBeGreaterThan(0.5);

    stepTicks(world, TICK_RATE);

    expect(
      Math.hypot(
        asteroid.get(PhysicsPosition)!.x,
        asteroid.get(PhysicsPosition)!.y,
      ),
    ).toBeGreaterThan(0.05);
  });

  it('lets asteroids bounce off each other without destroying either body', () => {
    const world = createPhysicsSpawnWorld();

    const rng = createPrng(7);
    const left = createAsteroid(
      world as unknown as Parameters<typeof createAsteroid>[0],
      rng,
      -0.35,
      0,
      ENTITY_CONFIG.ASTEROID.MASS,
      { velocity: { x: 1, y: 0 } },
    )!;
    const right = createAsteroid(
      world as unknown as Parameters<typeof createAsteroid>[0],
      rng,
      0.35,
      0,
      ENTITY_CONFIG.ASTEROID.MASS,
      { velocity: { x: -1, y: 0 } },
    )!;
    const leftShape = [...left.children(ChildOf)].find((child) =>
      child.get(Circle),
    );

    expect(
      (leftShape?.get(CollisionFilter)?.maskBits ?? 0) & CAT_ASTEROID,
    ).toBe(CAT_ASTEROID);

    stepTicks(world, 10);

    expect(count(world, Asteroid)).toBe(2);
    expect(left.get(LinearVelocity)!.x).toBeLessThan(0);
    expect(right.get(LinearVelocity)!.x).toBeGreaterThan(0);
  });

  it('creates phaser alien render components', () => {
    const { world } = createTestWorld();
    const alien = createAlien(
      world as unknown as Parameters<typeof createAlien>[0],
      createPrng(1234),
    );

    expect(alien.get(Polygon)?.points).toEqual([
      0.15, 0, -0.1, 0.1, -0.05, 0, -0.1, -0.1,
    ]);
    expect(alien.get(StrokeStyle)).toMatchObject({
      color: COLORS.orange,
      alpha: 1,
      width: 2,
    });
  });

  it('spawns aliens just outside an active player viewport', () => {
    const { world } = createTestWorld();
    world
      .entity()
      .set(PlayerShip, { playerIndex: 0, color: 0xffffff })
      .set(Position, { x: 1, y: 2 });

    const alien = createAlien(
      world as unknown as Parameters<typeof createAlien>[0],
      fixedAngleRng(0),
    );

    expect(alien.get(Position)).toMatchObject({
      x: 1 + VIEWPORT_WIDTH * 0.6,
      y: 2,
    });
  });

  it('clamps player-relative alien spawns inside world bounds', () => {
    const { world } = createTestWorld();
    world
      .entity()
      .set(PlayerShip, { playerIndex: 0, color: 0xffffff })
      .set(Position, { x: WORLD_MAX_X - 0.1, y: WORLD_MAX_Y - 0.1 });

    const alien = createAlien(
      world as unknown as Parameters<typeof createAlien>[0],
      fixedAngleRng(Math.PI / 4),
    );

    expect(alien.get(Position)).toMatchObject({
      x: WORLD_MAX_X - 0.5,
      y: WORLD_MAX_Y - 0.5,
    });
  });

  it('creates pickup arc and u32 stroke color render components', () => {
    const { world } = createTestWorld();
    const pickup = createPickup(
      world as unknown as Parameters<typeof createPickup>[0],
      createPrng(1234),
      PickupKind.Health,
    );

    expect(pickup.get(Arc)).toMatchObject({ radius: 0.15 });
    expect(pickup.get(StrokeStyle)).toMatchObject({
      color: PICKUP_COLORS[PickupKind.Health],
      alpha: 1,
      width: 2,
    });
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
    expect(count(world, Asteroid)).toBe(7 * WAVE_ASTEROID_SCALE);
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
      0.1,
      0.2,
      ENTITY_CONFIG.ASTEROID.MASS,
    )!;
    const asteroidB = createAsteroid(
      worldB as unknown as Parameters<typeof createAsteroid>[0],
      rngB,
      0.1,
      0.2,
      ENTITY_CONFIG.ASTEROID.MASS,
    )!;
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
    expect(pickupA.get(StrokeStyle)).toEqual(pickupB.get(StrokeStyle));
    expect(pickupA.get(Position)).toEqual(pickupB.get(Position));
  });
});
