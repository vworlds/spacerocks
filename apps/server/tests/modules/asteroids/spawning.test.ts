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
  Position,
  StrokeStyle,
} from '@vworlds/vecs-phaser';
import {
  CollisionFilter,
  LinearVelocity,
  PhysicsModule,
  Polygon as PhysicsPolygon,
  Position as PhysicsPosition,
} from '@vworlds/vecs-physics';
import {
  Alien,
  Asteroid,
  ASTEROID_FILL_COLORS,
  AsteroidView,
  CAT_ASTEROID,
  COLORS,
  ENTITY_CONFIG,
  GameStateView,
  MAX_ASTEROIDS_TOTAL_MASS,
  PlayerShip,
  Pickup,
  PICKUP_COLORS,
  PickupKind,
  TICK_RATE,
  VIEWPORT_WIDTH,
  WORLD_MAX_X,
  WORLD_MAX_Y,
  WORLD_MIN_X,
  WORLD_MIN_Y,
} from '@spacerocks/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Networked } from '@vworlds/vecs-server';
import { createPrng } from '../../../src/game/modules/rng/components';
import { RngModule } from '../../../src/game/modules/rng/module';
import type { Prng } from '../../../src/game/modules/rng/components';
import { GameStateModule } from '../../../src/game/modules/gameState/module';
import { SpawningModule } from '../../../src/game/modules/spawning/module';
import { registerSpawningComponents } from '../../../src/game/modules/spawning/components';
import { registerPlayerSessionComponents } from '../../../src/game/modules/playerSessions/components';
import {
  createAsteroid,
  getTotalAsteroidMass,
  randomAsteroidMass,
} from '../../../src/game/modules/asteroids/factory';
import { registerAsteroidsComponents } from '../../../src/game/modules/asteroids/components';
import { AsteroidsModule } from '../../../src/game/modules/asteroids/module';
import { createAlien } from '../../../src/game/modules/aliens/factory';
import { registerAliensComponents } from '../../../src/game/modules/aliens/components';
import { AliensModule } from '../../../src/game/modules/aliens/module';
import { createPickup } from '../../../src/game/modules/pickups/factory';
import { registerPickupsComponents } from '../../../src/game/modules/pickups/components';
import { PickupsModule } from '../../../src/game/modules/pickups/module';
import { registerWeaponsComponents } from '../../../src/game/modules/weapons/components';
import { createGameWorld } from '../../../src/index';
import {
  getGridCellIndex,
  neighbourIndices,
} from '../../../src/game/modules/interestGrid/grid';

function createTestWorld(seedOrRng: number | Prng = 1234): {
  world: World;
} {
  const world = new World();
  for (const component of phaserNetworkComponents) world.component(component);
  world.component(Networked);
  if (typeof seedOrRng === 'number') {
    world.module(RngModule, { seed: seedOrRng });
  } else {
    world.module(RngModule);
  }
  world.module(GameStateModule);
  registerPlayerSessionComponents(world);
  registerSpawningComponents(world);
  registerAsteroidsComponents(world);
  registerAliensComponents(world);
  registerPickupsComponents(world);
  registerWeaponsComponents(world);
  world.module(SpawningModule);
  world.module(AsteroidsModule);
  world.module(AliensModule);
  world.module(PickupsModule);
  return { world };
}

function createPhysicsSpawnWorld(): World {
  const world = new World();
  for (const component of phaserNetworkComponents) world.component(component);
  world.component(Networked);
  world.module(RngModule);
  registerPlayerSessionComponents(world);
  registerSpawningComponents(world);
  registerAsteroidsComponents(world);
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

function actualAsteroidMass(world: World): number {
  let total = 0;
  world.filter([Asteroid]).forEach([Asteroid], (_entity, [asteroid]) => {
    total += asteroid.mass;
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

  it('rolls bounded log-normal asteroid spawn masses', () => {
    const rng = createPrng(20240615);
    const samples = Array.from({ length: 100 }, () => randomAsteroidMass(rng));

    for (const mass of samples) {
      expect(mass).toBeGreaterThanOrEqual(ENTITY_CONFIG.ASTEROID.MIN_MASS);
      expect(mass).toBeLessThanOrEqual(ENTITY_CONFIG.ASTEROID.MAX_MASS);
    }
  });

  it('creates one networked GameStateView and fills initial asteroids to the mass cap in fixed world bounds', () => {
    const { world } = createTestWorld();

    expect(firstEntity(world, GameStateView)?.get(GameStateView)).toMatchObject(
      {
        state: 0,
        wave: 1,
        score: 0,
      },
    );
    expect(count(world, GameStateView)).toBe(1);
    expect(actualAsteroidMass(world)).toBeGreaterThanOrEqual(
      MAX_ASTEROIDS_TOTAL_MASS,
    );
    expect(actualAsteroidMass(world)).toBeLessThan(
      MAX_ASTEROIDS_TOTAL_MASS + ENTITY_CONFIG.ASTEROID.MAX_MASS,
    );
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
      world,
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

  it('renders asteroids with a greyscale fill and visible outline', () => {
    const { world } = createTestWorld();
    let intCalls = 0;
    const rng = {
      bool: () => false,
      int: (max: number) => {
        intCalls += 1;
        return intCalls === 1 ? max - 1 : 0;
      },
      range: () => 1,
    } as unknown as Prng;

    const asteroid = createAsteroid(
      world,
      rng,
      0,
      0,
      ENTITY_CONFIG.ASTEROID.MASS,
    )!;
    const fillColor = ASTEROID_FILL_COLORS[ASTEROID_FILL_COLORS.length - 1];

    expect(asteroid.get(FillStyle)).toMatchObject({
      color: fillColor,
      alpha: 1,
    });
    expect(asteroid.get(StrokeStyle)).toMatchObject({
      color: 0xcccccc,
      alpha: 1,
      width: 2,
    });
    expect(asteroid.get(AsteroidView)?.color).toBe(fillColor);
    expect(asteroid.get(Asteroid)?.color).toBe(fillColor);
  });

  it('lets asteroids bounce off each other without destroying either body', () => {
    const world = createPhysicsSpawnWorld();

    const rng = createPrng(7);
    const left = createAsteroid(
      world,
      rng,
      -0.35,
      0,
      ENTITY_CONFIG.ASTEROID.MASS,
      { velocity: { x: 1, y: 0 } },
    )!;
    const right = createAsteroid(
      world,
      rng,
      0.35,
      0,
      ENTITY_CONFIG.ASTEROID.MASS,
      { velocity: { x: -1, y: 0 } },
    )!;
    const leftShape = [...left.children(ChildOf)].find((child) =>
      child.get(PhysicsPolygon),
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
    const alien = createAlien(world, createPrng(1234));

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

    const alien = createAlien(world, fixedAngleRng(0));

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

    const alien = createAlien(world, fixedAngleRng(Math.PI / 4));

    expect(alien.get(Position)).toMatchObject({
      x: WORLD_MAX_X - 0.5,
      y: WORLD_MAX_Y - 0.5,
    });
  });

  it('creates pickup arc and u32 stroke color render components', () => {
    const { world } = createTestWorld();
    const pickup = createPickup(world, createPrng(1234), PickupKind.Health);

    expect(pickup.get(Arc)).toMatchObject({ radius: 0.15 });
    expect(pickup.get(StrokeStyle)).toMatchObject({
      color: PICKUP_COLORS[PickupKind.Health],
      alpha: 1,
      width: 2,
    });
  });

  it('does not continuously spawn asteroids while total mass is at the cap', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const { world } = createTestWorld();
    const startingCount = count(world, Asteroid);
    const startingMass = actualAsteroidMass(world);

    runSimulation(world, 1000);
    runSimulation(world, 2000);

    expect(firstEntity(world, GameStateView)?.get(GameStateView)).toMatchObject(
      {
        wave: 1,
      },
    );
    expect(startingMass).toBeGreaterThanOrEqual(MAX_ASTEROIDS_TOTAL_MASS);
    expect(count(world, Asteroid)).toBe(startingCount);
  });

  it('keeps reactive asteroid mass tracking consistent across catch-up, exits, and refill', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const world = await createGameWorld();
    const dt = 1000 / TICK_RATE;

    world.progress(0, dt);

    const initialActualMass = actualAsteroidMass(world as unknown as World);
    expect(getTotalAsteroidMass(world)).toBe(initialActualMass);
    expect(getTotalAsteroidMass(world)).toBeGreaterThanOrEqual(
      MAX_ASTEROIDS_TOTAL_MASS,
    );
    expect(getTotalAsteroidMass(world)).toBeLessThan(
      MAX_ASTEROIDS_TOTAL_MASS + ENTITY_CONFIG.ASTEROID.MAX_MASS,
    );

    const gameStateEntity = firstEntity(
      world as unknown as World,
      GameStateView,
    );
    if (!gameStateEntity) throw new Error('Expected GameStateView entity');
    gameStateEntity.set(GameStateView, {
      state: 1,
      wave: 1,
      score: 0,
      status: 'Paused',
    });

    const destroyedAsteroids: Entity[] = [];
    world.filter([Asteroid]).forEach([], (entity) => {
      if (destroyedAsteroids.length < 3) destroyedAsteroids.push(entity);
    });
    const destroyedMass = destroyedAsteroids.reduce(
      (sum, entity) => sum + (entity.get(Asteroid)?.mass ?? 0),
      0,
    );
    for (const asteroid of destroyedAsteroids) asteroid.destroy();

    world.progress(dt, dt);

    expect(getTotalAsteroidMass(world)).toBeCloseTo(
      initialActualMass - destroyedMass,
    );
    expect(getTotalAsteroidMass(world)).toBeCloseTo(
      actualAsteroidMass(world as unknown as World),
    );

    gameStateEntity.set(GameStateView, {
      state: 0,
      wave: 1,
      score: 0,
      status: '',
    });
    for (let tick = 2; tick <= 120; tick += 1) {
      world.progress(tick * dt, dt);
    }

    expect(getTotalAsteroidMass(world)).toBeCloseTo(
      actualAsteroidMass(world as unknown as World),
    );
    expect(getTotalAsteroidMass(world)).toBeGreaterThanOrEqual(
      MAX_ASTEROIDS_TOTAL_MASS,
    );
    expect(getTotalAsteroidMass(world)).toBeLessThan(
      MAX_ASTEROIDS_TOTAL_MASS + ENTITY_CONFIG.ASTEROID.MAX_MASS,
    );
  });

  it('continuously spawns asteroids only in cells unseen by players', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const { world } = createTestWorld();
    const asteroids: Entity[] = [];
    world.filter([Asteroid]).forEach([], (entity) => asteroids.push(entity));
    for (const entity of asteroids) entity.destroy();
    world.flush();

    const playerPosition = { x: 0, y: 0 };
    world
      .entity()
      .set(PlayerShip, { playerIndex: 0, color: 0xffffff })
      .set(Position, playerPosition);
    const visibleCells = new Set(
      neighbourIndices(getGridCellIndex(playerPosition)),
    );

    runSimulation(world, 1000);
    runSimulation(world, 2000);

    expect(count(world, Asteroid)).toBe(2);
    world
      .filter([Asteroid, Position])
      .forEach([Position], (_entity, [position]) => {
        expect(visibleCells.has(getGridCellIndex(position))).toBe(false);
      });
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
      worldA,
      rngA,
      0.1,
      0.2,
      ENTITY_CONFIG.ASTEROID.MASS,
    )!;
    const asteroidB = createAsteroid(
      worldB,
      rngB,
      0.1,
      0.2,
      ENTITY_CONFIG.ASTEROID.MASS,
    )!;
    const pickupA = createPickup(worldA, rngA, PickupKind.Health);
    const pickupB = createPickup(worldB, rngB, PickupKind.Health);

    expect(asteroidA.get(AsteroidView)).toEqual(asteroidB.get(AsteroidView));
    expect(pickupA.get(StrokeStyle)).toEqual(pickupB.get(StrokeStyle));
    expect(pickupA.get(Position)).toEqual(pickupB.get(Position));
  });
});
