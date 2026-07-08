import {
  ChildOf,
  World,
  type ComponentClass,
  type Entity,
} from '@vworlds/vecs';
import {
  FillStyle,
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
  ASTEROID_FILL_COLORS,
  CAT_ASTEROID,
  ENTITY_CONFIG,
  MAX_ASTEROIDS_TOTAL_MASS,
  NetworkComponentsModule,
  TICK_RATE,
  WORLD_MAX_X,
  WORLD_MAX_Y,
  WORLD_MIN_X,
  WORLD_MIN_Y,
} from '@spacerocks/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerNetworkFoundation } from '../helpers';
import { createPrng } from '../../../src/game/modules/rng/components';
import { RngModule } from '../../../src/game/modules/rng/module';
import type { Prng } from '../../../src/game/modules/rng/components';
import { GameStateModule } from '../../../src/game/modules/gameState/module';
import { GameStateView } from '../../../src/game/modules/gameState/components';
import { SpawningModule } from '../../../src/game/modules/spawning/module';
import { Components as SpawningComponents } from '../../../src/game/modules/spawning/components';
import { Components as PlayerSessionsComponents } from '../../../src/game/modules/playerSessions/components';
import { PlayerShip } from '../../../src/game/modules/playerShips/components';
import {
  createAsteroid,
  getTotalAsteroidMass,
  randomAsteroidMass,
} from '../../../src/game/modules/asteroids/factories';
import {
  Asteroid,
  AsteroidView,
  Components as AsteroidsComponents,
} from '../../../src/game/modules/asteroids/components';
import { AsteroidsModule } from '../../../src/game/modules/asteroids/module';
import { Components as WeaponsComponents } from '../../../src/game/modules/weapons/components';
import { DecayModule } from '../../../src/game/modules/decay/module';
import { Components as MovementComponents } from '../../../src/game/modules/movement/components';
import { createGameWorld } from '../../../src/index';
import {
  getGridCellIndex,
  neighbourIndices,
} from '../../../src/game/modules/interestGrid/grid';

function createTestWorld(seedOrRng: number | Prng = 1234): {
  world: World;
} {
  const world = new World();
  world.module(NetworkComponentsModule);
  registerNetworkFoundation(world);
  if (typeof seedOrRng === 'number') {
    world.module(RngModule, { seed: seedOrRng });
  } else {
    world.module(RngModule);
  }
  world.module(GameStateModule);
  world.module(PhysicsModule, {
    gravity: { x: 0, y: 0 },
    fixedTimeStep: 1 / TICK_RATE,
    subSteps: 4,
  });
  world.module(PlayerSessionsComponents);
  world.module(MovementComponents);
  world.module(SpawningComponents);
  world.module(AsteroidsComponents);
  world.module(WeaponsComponents);
  world.module(SpawningModule);
  world.module(DecayModule);
  world.module(AsteroidsModule);
  return { world };
}

function createPhysicsSpawnWorld(): World {
  const world = new World();
  world.module(NetworkComponentsModule);
  registerNetworkFoundation(world);
  world.module(RngModule);
  world.module(PlayerSessionsComponents);
  world.module(MovementComponents);
  world.module(SpawningComponents);
  world.module(AsteroidsComponents);
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

  it('does not continuously spawn asteroids while total mass is at the cap', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const { world } = createTestWorld();
    const startingCount = count(world, Asteroid);
    const startingMass = actualAsteroidMass(world);

    runSimulation(world, 1000);
    runSimulation(world, 2000);

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
    gameStateEntity.set(GameStateView, { state: 1 });

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

    gameStateEntity.set(GameStateView, { state: 0 });
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
    gameStateEntity.set(GameStateView, { state: 1 });

    runSimulation(world, 1000);
    runSimulation(world, 2000);

    expect(gameStateEntity.get(GameStateView)).toMatchObject({
      state: 1,
    });
    expect(count(world, Asteroid)).toBe(0);
  });
});
