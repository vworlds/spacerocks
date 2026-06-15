import { type ComponentClass, type Entity, Singleton } from '@vworlds/vecs';
import { Networked, type ServerWorld } from '@vworlds/vecs-server';
import {
  Arc,
  FillStyle,
  Polygon,
  Position as RenderPosition,
  Rotation as RenderRotation,
  StrokeStyle,
} from '@vworlds/vecs-phaser';
import {
  Body,
  BodyType,
  Circle,
  CollisionFilter,
  Detectable,
  LinearVelocity,
  Material,
  Position as PhysicsPosition,
  Rotation as PhysicsRotation,
  Sensor,
  SensorEvents,
} from '@vworlds/vecs-physics';
import {
  Alien,
  Asteroid,
  AsteroidView,
  ASTEROID_FILL_COLORS,
  CAT_ASTEROID,
  CAT_BOOMERANG,
  CAT_ENEMY,
  CAT_ENEMY_BULLET,
  CAT_PICKUP,
  CAT_PLAYER,
  CAT_PLAYER_BULLET,
  COLORS,
  Decay,
  ENTITY_CONFIG,
  GAME_CONFIG,
  GameStateView,
  Health,
  HealthPickup,
  MAX_ASTEROIDS_TOTAL_MASS,
  Pickup,
  PICKUP_COLORS,
  PickupKind,
  PlayerShip,
  perSecond,
  RandomClockKind,
  VIEWPORT_WIDTH,
  WORLD_MAX_X,
  WORLD_MAX_Y,
  WORLD_MIN_X,
  WORLD_MIN_Y,
  Wraps,
} from '@spacerocks/common';
import { createPrng, type Prng } from './rng';
import {
  getGridCellIndex,
  GRID_CELL_COUNT,
  neighbourIndices,
  randomPointInGridCell,
} from '../network/interestGrid';

const GAME_STATE_PLAYING = 0; // enum id
const INITIAL_WAVE = 1; // legacy GameStateView field value
const ALIEN_SPAWN_MARGIN = 0.5; // meters
const ASTEROID_OUTLINE_COLOR = 0xcccccc;

type AsteroidOptions = {
  velocity?: { x: number; y: number };
  color?: number;
  collidable?: boolean;
  ttlFrames?: number;
  alpha?: number;
};

const PICKUP_TTL_FRAMES: Record<PickupKind, number> = {
  [PickupKind.Shield]: GAME_CONFIG.SHIELD_PICKUP_TTL_FRAMES,
  [PickupKind.Laser]: GAME_CONFIG.LASER_PICKUP_TTL_FRAMES,
  [PickupKind.Aura]: GAME_CONFIG.AURA_PICKUP_TTL_FRAMES,
  [PickupKind.Rocket]: GAME_CONFIG.ROCKET_PICKUP_TTL_FRAMES,
  [PickupKind.Boomerang]: GAME_CONFIG.BOOMERANG_PICKUP_TTL_FRAMES,
  [PickupKind.Health]: GAME_CONFIG.HEALTH_PICKUP_TTL_FRAMES,
};

class SpawnTimer {
  kind: RandomClockKind = RandomClockKind.Alien;
  minWait = 0; // ms
  maxWait = 0; // ms
  nextTick = 0; // unix ms
}

// Running total of live asteroid mass, held as a singleton component so the
// world owns it (no module-level per-world map). Maintained reactively by the
// TrackAsteroidMass system; read O(1) via the captured instance in the spawner.
class AsteroidMassTotal {
  total = 0; // kg
}

export function registerSpawningComponents(world: ServerWorld): void {
  world.component(SpawnTimer);
  world.component(Asteroid);
  world.component(AsteroidView);
  world.component(Alien);
  world.component(Pickup);
  world.component(HealthPickup);
  world.component(Decay);
  world.component(GameStateView);
  world.component(Material);
  world.component(Detectable);
  world.component(AsteroidMassTotal).add(Singleton);
}

export function installSpawningSystems(
  world: ServerWorld,
  rng: Prng = createPrng(readServerSeed()),
): void {
  initializeGameWorld(world, rng, Date.now());

  // Running total of live asteroid mass, kept on the AsteroidMassTotal singleton
  // (created by its Singleton trait). enter adds the asteroid's mass, exit
  // subtracts it; both run in deferred mode, so getMut yields the live instance
  // for an in-place O(1) update. The injected component is snapshotted at routing
  // time, so it resolves even for an asteroid spawned and destroyed within one
  // undrained window — keeping the total balanced with no per-entity bookkeeping.
  world
    .system('TrackAsteroidMass')
    .with(Asteroid)
    .enter([Asteroid], (_entity, [asteroid]) => {
      world.component(AsteroidMassTotal).getMut(AsteroidMassTotal)!.total +=
        asteroid.mass;
    })
    .exit([Asteroid], (_entity, [asteroid]) => {
      world.component(AsteroidMassTotal).getMut(AsteroidMassTotal)!.total -=
        asteroid.mass;
    });

  // Persistent, reactively-maintained query: the spawner reads current players
  // without rebuilding a filter (which would re-evaluate matches across the
  // world) on every tick.
  const players = world
    .query('SpawnerPlayers')
    .with(PlayerShip, RenderPosition)
    .build();

  world
    .system('ServerRandomClockSystem')
    .interval(0.5)
    .with(SpawnTimer)
    .each([SpawnTimer], (_entity, [timer]) => {
      if (!isPlaying(world)) return;
      const now = Date.now();
      if (now < timer.nextTick) return;

      dispatchSpawn(world, rng, timer.kind);
      scheduleTimer(timer, rng, now);
    });

  world
    .system('ServerAsteroidSpawner')
    .interval(1)
    .with(GameStateView)
    .each([GameStateView], (_entity, [state]) => {
      if (state.state !== GAME_STATE_PLAYING) return;
      spawnAsteroidIfBelowMassCap(
        world,
        rng,
        world.get(AsteroidMassTotal)?.total ?? 0,
        players,
      );
    });
}

export function getTrackedAsteroidMass(world: ServerWorld): number {
  return world.get(AsteroidMassTotal)?.total ?? 0;
}

export function createAsteroid(
  world: ServerWorld,
  rng: Prng,
  x: number,
  y: number,
  mass: number = ENTITY_CONFIG.ASTEROID.MASS,
  options: AsteroidOptions = {},
): Entity | undefined {
  const collidable = options.collidable ?? true;
  if (collidable && mass < ENTITY_CONFIG.ASTEROID.MIN_COLLIDABLE_MASS)
    return undefined;

  const radius = asteroidRadius(mass);
  const speedFactor = ENTITY_CONFIG.ASTEROID.SPEED_FACTOR;
  const fillColor =
    options.color ??
    ASTEROID_FILL_COLORS[rng.int(ASTEROID_FILL_COLORS.length)] ??
    COLORS.asteroidGrey;
  const alpha = options.alpha ?? 1;
  const vert = 5 + rng.int(5);
  const velocity = options.velocity ?? {
    x: perSecond(rng.range(-0.5, 0.5) * speedFactor),
    y: perSecond(rng.range(-0.5, 0.5) * speedFactor),
  };
  const maskBits =
    CAT_ASTEROID |
    CAT_PLAYER |
    CAT_PLAYER_BULLET |
    CAT_ENEMY_BULLET |
    CAT_ENEMY |
    CAT_BOOMERANG;
  const points: number[] = [];
  for (let i = 0; i < vert; i += 1) {
    const r = radius * rng.range(0.8, 1.2);
    const a = (i / vert) * Math.PI * 2;
    points.push(Math.cos(a) * r, Math.sin(a) * r);
  }

  const asteroid = world
    .entity()
    .add(Networked)
    .set(Body, { type: BodyType.Dynamic })
    .set(PhysicsPosition, { x, y })
    .set(LinearVelocity, velocity)
    .set(RenderPosition, { x, y })
    .set(AsteroidView, { color: fillColor, radius, mass })
    .add(Wraps)
    .set(FillStyle, { color: fillColor, alpha })
    .set(StrokeStyle, { color: ASTEROID_OUTLINE_COLOR, alpha, width: 2 })
    .set(Polygon, { points });

  if (collidable) {
    asteroid.set(Asteroid, { mass, color: fillColor });
    createPhysicsCircleSolid(
      world,
      asteroid,
      radius,
      CAT_ASTEROID,
      maskBits,
      ENTITY_CONFIG.ASTEROID.DENSITY,
    );
  } else if (options.ttlFrames) {
    asteroid.set(Decay, { life: options.ttlFrames, decay: 1 });
  }

  return asteroid;
}

export function asteroidRadius(mass: number): number {
  return Math.sqrt(mass / (Math.PI * ENTITY_CONFIG.ASTEROID.DENSITY));
}

export function rollAsteroidSpawnMass(rng: Prng): number {
  if (!rng.bool(ENTITY_CONFIG.ASTEROID.LARGE_MASS_CHANCE)) {
    return ENTITY_CONFIG.ASTEROID.MASS;
  }

  return (
    ENTITY_CONFIG.ASTEROID.MASS *
    rng.range(
      ENTITY_CONFIG.ASTEROID.LARGE_MASS_MIN_MULT,
      ENTITY_CONFIG.ASTEROID.LARGE_MASS_MAX_MULT,
    )
  );
}

export function createAlien(world: ServerWorld, rng: Prng): Entity {
  const { x, y } = chooseAlienSpawnPosition(world, rng);
  const vx = rng.range(-0.5, 0.5) * ENTITY_CONFIG.ALIEN.SPEED_FACTOR;
  const vy = rng.range(-0.5, 0.5) * ENTITY_CONFIG.ALIEN.SPEED_FACTOR;
  const angle = rng.range(0, Math.PI * 2);
  const maskBits =
    CAT_PLAYER | CAT_ASTEROID | CAT_PLAYER_BULLET | CAT_BOOMERANG;
  const alien = world
    .entity()
    .add(Networked)
    .set(Body, { type: BodyType.Dynamic })
    .set(PhysicsPosition, { x, y })
    .set(PhysicsRotation, { angle })
    .set(LinearVelocity, { x: perSecond(vx), y: perSecond(vy) })
    .set(RenderPosition, { x, y })
    .set(RenderRotation, { angle })
    .set(Alien, { shootCooldown: ENTITY_CONFIG.ALIEN.SHOOT_COOLDOWN_BASE })
    .set(Health, {
      hp: ENTITY_CONFIG.ALIEN.MAX_HP,
      maxHp: ENTITY_CONFIG.ALIEN.MAX_HP,
      healthBarTimer: 0,
    })
    .add(Wraps)
    .set(StrokeStyle, { color: COLORS.orange, alpha: 1, width: 2 })
    .set(Polygon, { points: [0.15, 0, -0.1, 0.1, -0.05, 0, -0.1, -0.1] });

  createPhysicsCircleSolid(
    world,
    alien,
    ENTITY_CONFIG.ALIEN.RADIUS,
    CAT_ENEMY,
    CAT_ASTEROID,
    ENTITY_CONFIG.ALIEN.MASS /
      (Math.PI * ENTITY_CONFIG.ALIEN.RADIUS * ENTITY_CONFIG.ALIEN.RADIUS),
  );
  createPhysicsCircleSensor(
    world,
    alien,
    ENTITY_CONFIG.ALIEN.RADIUS,
    CAT_ENEMY,
    maskBits,
  );
  return alien;
}

function chooseAlienSpawnPosition(
  world: ServerWorld,
  rng: Prng,
): { x: number; y: number } {
  const players: Array<{ x: number; y: number }> = [];
  world
    .filter([PlayerShip, RenderPosition])
    .forEach([RenderPosition], (_entity, [position]) => {
      players.push({ x: position.x, y: position.y });
    });

  if (players.length === 0) {
    return {
      x: rng.bool() ? WORLD_MIN_X - 0.2 : WORLD_MAX_X + 0.2,
      y: rng.range(WORLD_MIN_Y, WORLD_MAX_Y),
    };
  }

  const player = players[rng.int(players.length)]!;
  const angle = rng.range(0, Math.PI * 2);
  const distance = VIEWPORT_WIDTH * 0.6;

  return {
    x: clamp(
      player.x + Math.cos(angle) * distance,
      WORLD_MIN_X + ALIEN_SPAWN_MARGIN,
      WORLD_MAX_X - ALIEN_SPAWN_MARGIN,
    ),
    y: clamp(
      player.y + Math.sin(angle) * distance,
      WORLD_MIN_Y + ALIEN_SPAWN_MARGIN,
      WORLD_MAX_Y - ALIEN_SPAWN_MARGIN,
    ),
  };
}

export function createPickup(
  world: ServerWorld,
  rng: Prng,
  kind: PickupKind,
): Entity {
  const amount = kind === PickupKind.Health ? (rng.bool() ? 0.25 : 0.5) : 0;
  const x = rng.range(WORLD_MIN_X, WORLD_MAX_X);
  const y = rng.range(WORLD_MIN_Y, WORLD_MAX_Y);
  const vx = rng.range(-0.5, 0.5) * ENTITY_CONFIG.POWERUP.SPEED_FACTOR;
  const vy = rng.range(-0.5, 0.5) * ENTITY_CONFIG.POWERUP.SPEED_FACTOR;
  const entity = world
    .entity()
    .add(Networked)
    .set(Body, { type: BodyType.Dynamic })
    .set(PhysicsPosition, { x, y })
    .set(LinearVelocity, { x: perSecond(vx), y: perSecond(vy) })
    .set(RenderPosition, { x, y })
    .set(Pickup, { kind })
    .set(Decay, {
      life: 1,
      decay: 1 / PICKUP_TTL_FRAMES[kind],
    })
    .add(Wraps)
    .set(StrokeStyle, { color: PICKUP_COLORS[kind], alpha: 1, width: 2 })
    .set(Arc, { radius: ENTITY_CONFIG.POWERUP.RADIUS });

  if (kind === PickupKind.Health) entity.set(HealthPickup, { amount });
  createPhysicsCircleSensor(
    world,
    entity,
    ENTITY_CONFIG.POWERUP.RADIUS,
    CAT_PICKUP,
    CAT_PLAYER,
  );
  return entity;
}

function createPhysicsCircleSensor(
  world: ServerWorld,
  body: Entity,
  radius: number,
  categoryBits: number,
  maskBits: number,
): void {
  world
    .entity()
    .childOf(body)
    .set(Circle, { radius })
    .add(Sensor)
    .add(SensorEvents)
    .set(CollisionFilter, {
      categoryBits,
      maskBits,
    });
}

function initializeGameWorld(world: ServerWorld, rng: Prng, now: number): void {
  world.entity().add(Networked).set(GameStateView, {
    state: GAME_STATE_PLAYING,
    wave: INITIAL_WAVE,
    score: 0,
    status: '',
  });

  createSpawnTimer(
    world,
    rng,
    now,
    RandomClockKind.Alien,
    GAME_CONFIG.ALIEN_SPAWN_MIN_WAIT,
    GAME_CONFIG.ALIEN_SPAWN_MAX_WAIT,
  );
  createSpawnTimer(
    world,
    rng,
    now,
    RandomClockKind.ShieldPickup,
    GAME_CONFIG.SHIELD_SPAWN_MIN_WAIT,
    GAME_CONFIG.SHIELD_SPAWN_MAX_WAIT,
  );
  createSpawnTimer(
    world,
    rng,
    now,
    RandomClockKind.LaserPickup,
    GAME_CONFIG.LASER_SPAWN_MIN_WAIT,
    GAME_CONFIG.LASER_SPAWN_MAX_WAIT,
  );
  createSpawnTimer(
    world,
    rng,
    now,
    RandomClockKind.AuraPickup,
    GAME_CONFIG.AURA_SPAWN_MIN_WAIT,
    GAME_CONFIG.AURA_SPAWN_MAX_WAIT,
  );
  createSpawnTimer(
    world,
    rng,
    now,
    RandomClockKind.RocketPickup,
    GAME_CONFIG.ROCKET_SPAWN_MIN_WAIT,
    GAME_CONFIG.ROCKET_SPAWN_MAX_WAIT,
  );
  createSpawnTimer(
    world,
    rng,
    now,
    RandomClockKind.BoomerangPickup,
    GAME_CONFIG.BOOMERANG_SPAWN_MIN_WAIT,
    GAME_CONFIG.BOOMERANG_SPAWN_MAX_WAIT,
  );
  createSpawnTimer(
    world,
    rng,
    now,
    RandomClockKind.HealthPickup,
    GAME_CONFIG.HEALTH_SPAWN_MIN_WAIT,
    GAME_CONFIG.HEALTH_SPAWN_MAX_WAIT,
  );

  fillInitialAsteroids(world, rng);
}

function fillInitialAsteroids(world: ServerWorld, rng: Prng): void {
  let filledMass = 0;
  while (filledMass < MAX_ASTEROIDS_TOTAL_MASS) {
    let x: number;
    let y: number;
    do {
      x = rng.range(WORLD_MIN_X, WORLD_MAX_X);
      y = rng.range(WORLD_MIN_Y, WORLD_MAX_Y);
    } while (Math.hypot(x, y) < 2.0);
    const mass = rollAsteroidSpawnMass(rng);
    createAsteroid(world, rng, x, y, mass);
    filledMass += mass;
  }
}

function spawnAsteroidIfBelowMassCap(
  world: ServerWorld,
  rng: Prng,
  totalAsteroidMass: number,
  players: Iterable<Entity>,
): void {
  if (totalAsteroidMass >= MAX_ASTEROIDS_TOTAL_MASS) return;

  const cellIndex = chooseUnseenGridCell(players, rng);
  if (cellIndex === undefined) return;

  const { x, y } = randomPointInGridCell(cellIndex, rng);
  createAsteroid(world, rng, x, y, rollAsteroidSpawnMass(rng));
}

function chooseUnseenGridCell(
  players: Iterable<Entity>,
  rng: Prng,
): number | undefined {
  const visibleCells = new Set<number>();
  for (const player of players) {
    const position = player.get(RenderPosition);
    if (!position) continue;
    for (const cellIndex of neighbourIndices(getGridCellIndex(position))) {
      visibleCells.add(cellIndex);
    }
  }

  const candidates: number[] = [];
  for (let cellIndex = 0; cellIndex < GRID_CELL_COUNT; cellIndex += 1) {
    if (!visibleCells.has(cellIndex)) candidates.push(cellIndex);
  }
  if (candidates.length === 0) return undefined;

  return candidates[rng.int(candidates.length)];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function createPhysicsCircleSolid(
  world: ServerWorld,
  body: Entity,
  radius: number,
  categoryBits: number,
  maskBits: number,
  density: number,
): void {
  world
    .entity()
    .childOf(body)
    .set(Circle, { radius })
    .set(Material, {
      density,
      friction: 0,
      restitution: 0.85,
    })
    .add(Detectable)
    .set(CollisionFilter, {
      categoryBits,
      maskBits,
    });
}

function createSpawnTimer(
  world: ServerWorld,
  rng: Prng,
  now: number,
  kind: RandomClockKind,
  minWait: number,
  maxWait: number,
): void {
  const timer = new SpawnTimer();
  timer.kind = kind;
  timer.minWait = minWait;
  timer.maxWait = maxWait;
  scheduleTimer(timer, rng, now);
  world.entity().set(SpawnTimer, timer);
}

function scheduleTimer(timer: SpawnTimer, rng: Prng, now: number): void {
  timer.nextTick = now + rng.range(timer.minWait, timer.maxWait);
}

function dispatchSpawn(
  world: ServerWorld,
  rng: Prng,
  kind: RandomClockKind,
): void {
  if (kind === RandomClockKind.Alien) {
    if (countEntities(world, Alien) < GAME_CONFIG.ALIEN_CAP)
      createAlien(world, rng);
  } else if (kind === RandomClockKind.ShieldPickup) {
    createPickup(world, rng, PickupKind.Shield);
  } else if (kind === RandomClockKind.LaserPickup) {
    createPickup(world, rng, PickupKind.Laser);
  } else if (kind === RandomClockKind.AuraPickup) {
    createPickup(world, rng, PickupKind.Aura);
  } else if (kind === RandomClockKind.RocketPickup) {
    createPickup(world, rng, PickupKind.Rocket);
  } else if (kind === RandomClockKind.BoomerangPickup) {
    createPickup(world, rng, PickupKind.Boomerang);
  } else {
    createPickup(world, rng, PickupKind.Health);
  }
}

function isPlaying(world: ServerWorld): boolean {
  const gameState = getGameState(world);
  return !gameState || gameState.state === GAME_STATE_PLAYING;
}

function getGameState(world: ServerWorld): GameStateView | undefined {
  return getGameStateEntity(world)?.get(GameStateView);
}

function getGameStateEntity(world: ServerWorld): Entity | undefined {
  let gameStateEntity: Entity | undefined;
  world.filter([GameStateView]).forEach([], (entity) => {
    gameStateEntity ??= entity;
  });
  return gameStateEntity;
}

function countEntities(world: ServerWorld, component: ComponentClass): number {
  let count = 0;
  world.filter([component]).forEach([], () => {
    count += 1;
  });
  return count;
}

function readServerSeed(): number {
  const configuredSeed = Number(process.env.SPACEROCKS_SEED ?? 0x5eed1234);
  return Number.isFinite(configuredSeed) ? configuredSeed : 0x5eed1234;
}
