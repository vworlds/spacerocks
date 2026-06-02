import type { ComponentClass, Entity } from '@vworlds/vecs';
import { Networked, type ServerWorld } from '@vworlds/vecs-server';
import {
  Alien,
  Arc,
  Asteroid,
  AsteroidView,
  CAT_ASTEROID,
  CAT_BOOMERANG,
  CAT_ENEMY,
  CAT_ENEMY_BULLET,
  CAT_PICKUP,
  CAT_PLAYER,
  CAT_PLAYER_BULLET,
  Collider,
  Decay,
  Drawable,
  ENTITY_CONFIG,
  GAME_CONFIG,
  GameStateView,
  Health,
  HealthView,
  HealthPickup,
  Pickup,
  PickupKind,
  PickupView,
  Position,
  RandomClockKind,
  Rotation,
  Shape,
  StrokeStyle,
  Velocity,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  Wraps,
  type Point,
} from '@spacerocks/common';
import { createPrng, type Prng } from './rng';

type ServerPhase = ReturnType<ServerWorld['addPhase']>;

const GAME_STATE_PLAYING = 0;
const INITIAL_WAVE = 1;
const ASTEROID_COLORS = ['#aaa', '#888', '#bbb', '#999', '#777'] as const;
const ASTEROID_RADII: Record<1 | 2 | 3, number> = { 1: 10, 2: 20, 3: 40 };

const PICKUP_TTL_FRAMES: Record<PickupKind, number> = {
  [PickupKind.Shield]: GAME_CONFIG.SHIELD_PICKUP_TTL_FRAMES,
  [PickupKind.Laser]: GAME_CONFIG.LASER_PICKUP_TTL_FRAMES,
  [PickupKind.Aura]: GAME_CONFIG.AURA_PICKUP_TTL_FRAMES,
  [PickupKind.Rocket]: GAME_CONFIG.ROCKET_PICKUP_TTL_FRAMES,
  [PickupKind.Boomerang]: GAME_CONFIG.BOOMERANG_PICKUP_TTL_FRAMES,
  [PickupKind.Health]: GAME_CONFIG.HEALTH_PICKUP_TTL_FRAMES,
};

const PICKUP_CONFIG: Record<PickupKind, { color: string; viewKind: number }> = {
  [PickupKind.Shield]: { color: '#0f0', viewKind: 0 },
  [PickupKind.Laser]: { color: '#f00', viewKind: 1 },
  [PickupKind.Aura]: { color: '#3af', viewKind: 2 },
  [PickupKind.Rocket]: { color: '#ff6600', viewKind: 3 },
  [PickupKind.Boomerang]: { color: '#006400', viewKind: 4 },
  [PickupKind.Health]: { color: '#fff', viewKind: 5 },
};

class SpawnTimer {
  kind: RandomClockKind = RandomClockKind.Alien;
  minWait = 0;
  maxWait = 0;
  nextTick = 0;
}

export function registerSpawningComponents(world: ServerWorld): void {
  world.component(SpawnTimer);
  world.component(Asteroid);
  world.component(AsteroidView);
  world.component(Alien);
  world.component(Pickup);
  world.component(PickupView);
  world.component(HealthPickup);
  world.component(Decay);
  world.component(Arc);
  world.component(GameStateView);
}

export function installSpawningSystems(
  world: ServerWorld,
  simulationPhase: ServerPhase,
  rng: Prng = createPrng(readServerSeed()),
): void {
  initializeGameWorld(world, rng, Date.now());

  world
    .system('ServerRandomClockSystem')
    .interval(0.5)
    .requires(SpawnTimer)
    .phase(simulationPhase)
    .each([SpawnTimer], (_entity, [timer]) => {
      if (!isPlaying(world)) return;
      const now = Date.now();
      if (now < timer.nextTick) return;

      dispatchSpawn(world, rng, timer.kind);
      scheduleTimer(timer, rng, now);
    });

  world
    .system('ServerWave')
    .interval(0.25)
    .requires(GameStateView)
    .phase(simulationPhase)
    .each([GameStateView], (entity, [state]) => {
      if (state.state !== GAME_STATE_PLAYING) return;
      if (
        countEntities(world, Asteroid) > 0 ||
        countEntities(world, Alien) > 0
      ) {
        return;
      }

      state.wave += 1;
      entity.modified(GameStateView);
      spawnWave(world, rng, state.wave);
    });
}

export function createAsteroid(
  world: ServerWorld,
  rng: Prng,
  x: number,
  y: number,
  level: 1 | 2 | 3,
): Entity {
  const radius = ASTEROID_RADII[level];
  const color = ASTEROID_COLORS[rng.int(ASTEROID_COLORS.length)] ?? '#aaa';
  const vert = 5 + rng.int(5);
  const points: Point[] = [];
  for (let i = 0; i < vert; i += 1) {
    const r = radius * rng.range(0.8, 1.2);
    const a = (i / vert) * Math.PI * 2;
    points.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
  }

  return world
    .entity()
    .add(Networked)
    .set(Position, { x, y })
    .set(Velocity, {
      vx: rng.range(-0.5, 0.5) * (ENTITY_CONFIG.ASTEROID.SPEED_FACTOR - level),
      vy: rng.range(-0.5, 0.5) * (ENTITY_CONFIG.ASTEROID.SPEED_FACTOR - level),
    })
    .set(Asteroid, { level, color })
    .set(AsteroidView, { level, color, radius })
    .set(Collider, {
      radius,
      category: CAT_ASTEROID,
      mask:
        CAT_PLAYER |
        CAT_PLAYER_BULLET |
        CAT_ENEMY_BULLET |
        CAT_ENEMY |
        CAT_BOOMERANG,
    })
    .set(Drawable, { zIndex: 30 })
    .add(Wraps)
    .set(StrokeStyle, { style: color, lineWidth: 2 })
    .set(Shape, { points });
}

export function createAlien(world: ServerWorld, rng: Prng): Entity {
  return world
    .entity()
    .add(Networked)
    .set(Position, {
      x: rng.bool() ? -20 : WORLD_WIDTH + 20,
      y: rng.range(0, WORLD_HEIGHT),
    })
    .set(Velocity, {
      vx: rng.range(-0.5, 0.5) * ENTITY_CONFIG.ALIEN.SPEED_FACTOR,
      vy: rng.range(-0.5, 0.5) * ENTITY_CONFIG.ALIEN.SPEED_FACTOR,
    })
    .set(Rotation, { angle: rng.range(0, Math.PI * 2) })
    .set(Alien, { shootCooldown: ENTITY_CONFIG.ALIEN.SHOOT_COOLDOWN_BASE })
    .set(Health, {
      hp: ENTITY_CONFIG.ALIEN.MAX_HP,
      maxHp: ENTITY_CONFIG.ALIEN.MAX_HP,
      healthBarTimer: 0,
    })
    .set(HealthView, {
      hp: ENTITY_CONFIG.ALIEN.MAX_HP,
      maxHp: ENTITY_CONFIG.ALIEN.MAX_HP,
      barTimer: 0,
    })
    .set(Collider, {
      radius: ENTITY_CONFIG.ALIEN.RADIUS,
      category: CAT_ENEMY,
      mask: CAT_PLAYER | CAT_ASTEROID | CAT_PLAYER_BULLET | CAT_BOOMERANG,
    })
    .set(Drawable, { zIndex: 40 })
    .add(Wraps)
    .set(StrokeStyle, { style: '#ffaa00', lineWidth: 2 })
    .set(Shape, {
      points: [
        { x: 15, y: 0 },
        { x: -10, y: 10 },
        { x: -5, y: 0 },
        { x: -10, y: -10 },
      ],
    });
}

export function createPickup(
  world: ServerWorld,
  rng: Prng,
  kind: PickupKind,
): Entity {
  const config = PICKUP_CONFIG[kind];
  const amount = kind === PickupKind.Health ? (rng.bool() ? 0.25 : 0.5) : 0;
  const entity = world
    .entity()
    .add(Networked)
    .set(Position, {
      x: rng.range(0, WORLD_WIDTH),
      y: rng.range(0, WORLD_HEIGHT),
    })
    .set(Velocity, {
      vx: rng.range(-0.5, 0.5) * ENTITY_CONFIG.POWERUP.SPEED_FACTOR,
      vy: rng.range(-0.5, 0.5) * ENTITY_CONFIG.POWERUP.SPEED_FACTOR,
    })
    .set(Pickup, { kind })
    .set(PickupView, { kind: config.viewKind, amount })
    .set(Decay, {
      life: 1,
      decay: 1 / PICKUP_TTL_FRAMES[kind],
    })
    .set(Collider, {
      radius: ENTITY_CONFIG.POWERUP.RADIUS,
      category: CAT_PICKUP,
      mask: CAT_PLAYER,
    })
    .set(Drawable, { zIndex: 50 })
    .add(Wraps)
    .set(StrokeStyle, { style: config.color, lineWidth: 2 })
    .set(Arc, { radius: ENTITY_CONFIG.POWERUP.RADIUS });

  if (kind === PickupKind.Health) entity.set(HealthPickup, { amount });
  return entity;
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

  spawnWave(world, rng, INITIAL_WAVE);
}

function spawnWave(world: ServerWorld, rng: Prng, wave: number): void {
  const count = 3 + wave * 2;
  for (let i = 0; i < count; i += 1) {
    let x: number;
    let y: number;
    do {
      x = rng.range(0, WORLD_WIDTH);
      y = rng.range(0, WORLD_HEIGHT);
    } while (Math.hypot(x - WORLD_WIDTH / 2, y - WORLD_HEIGHT / 2) < 200);
    createAsteroid(world, rng, x, y, 3);
  }
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
