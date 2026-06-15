export const PIXELS_PER_METER = 100; // pixels/meter
export const WORLD_WIDTH = 10.24; // meters
export const WORLD_HEIGHT = 7.68; // meters
export const WORLD_MIN_X = -WORLD_WIDTH / 2; // meters
export const WORLD_MAX_X = WORLD_WIDTH / 2; // meters
export const WORLD_MIN_Y = -WORLD_HEIGHT / 2; // meters
export const WORLD_MAX_Y = WORLD_HEIGHT / 2; // meters
export const CLIENT_ENTITY_ID_START = 1_000_000; // entity id
const BASE_TICK_RATE = 60; // frames/second
export const TICK_RATE = 30; // frames/second
const FRAME_RATE_SCALE = BASE_TICK_RATE / TICK_RATE;

export function toFrames(ms: number): number {
  return Math.round((ms / 1000) * TICK_RATE);
}

export function perFrame(valueAtBaseTickRate: number): number {
  return valueAtBaseTickRate * FRAME_RATE_SCALE;
}

/** Converts authored per-frame quantities to per-second values for vecs-physics velocities. */
export function perSecond(metersPerFrame: number): number {
  return metersPerFrame * TICK_RATE;
}

export function perFrameMultiplier(multiplierAtBaseTickRate: number): number {
  return multiplierAtBaseTickRate ** FRAME_RATE_SCALE;
}

export const GAME_CONFIG = {
  ALIEN_SPAWN_MIN_WAIT: 10000, // ms
  ALIEN_SPAWN_MAX_WAIT: 20000, // ms
  ALIEN_CAP: 3, // entities

  SHIELD_SPAWN_MIN_WAIT: 8000, // ms
  SHIELD_SPAWN_MAX_WAIT: 21000, // ms
  LASER_SPAWN_MIN_WAIT: 30000, // ms
  LASER_SPAWN_MAX_WAIT: 70000, // ms
  AURA_SPAWN_MIN_WAIT: 45000, // ms
  AURA_SPAWN_MAX_WAIT: 99000, // ms
  ROCKET_SPAWN_MIN_WAIT: 50000, // ms
  ROCKET_SPAWN_MAX_WAIT: 110000, // ms
  BOOMERANG_SPAWN_MIN_WAIT: 50000, // ms
  BOOMERANG_SPAWN_MAX_WAIT: 110000, // ms
  HEALTH_SPAWN_MIN_WAIT: 18000, // ms
  HEALTH_SPAWN_MAX_WAIT: 42000, // ms

  SHIELD_PICKUP_TTL_FRAMES: toFrames(12_000), // frames
  LASER_PICKUP_TTL_FRAMES: toFrames(12_000), // frames
  AURA_PICKUP_TTL_FRAMES: toFrames(12_000), // frames
  ROCKET_PICKUP_TTL_FRAMES: toFrames(12_000), // frames
  BOOMERANG_PICKUP_TTL_FRAMES: toFrames(12_000), // frames
  HEALTH_PICKUP_TTL_FRAMES: toFrames(12_000), // frames
} as const;

export const ENTITY_CONFIG = {
  BULLET: {
    SPEED: perFrame(0.07), // meters/frame
    LIFE: toFrames(1_667), // frames
    DAMAGE: 10, // hp
  },
  ASTEROID: {
    SPEED_FACTOR: perFrame(0.04), // meters/frame multiplier
  },
  POWERUP: {
    SPEED_FACTOR: perFrame(0.01), // meters/frame multiplier
    RADIUS: 0.15, // meters
  },
  ALIEN: {
    RADIUS: 0.15, // meters
    SPEED_FACTOR: perFrame(0.02), // meters/frame multiplier
    SHOOT_COOLDOWN_BASE: toFrames(1_000), // frames
    SHOOT_COOLDOWN_RANGE: toFrames(667), // frames
    TARGET_DIST_MAX: 4, // meters
    ASTEROID_AVOID_DIST: 0.6, // meters
    MAX_HP: 20, // hp
  },
  ROCKET: {
    SPEED: perFrame(0.05), // meters/frame
    LIFE: toFrames(6_667), // frames
    STRAIGHT_FRAMES: toFrames(500), // frames
    HOME_RANGE: 2.5, // meters
    TURN_RATE: perFrame(0.08), // radians/frame
    SHOT_COUNT: 5, // shots
    DAMAGE: 20, // hp
  },
  BOOMERANG: {
    SPEED: perFrame(0.19), // meters/frame
    MAX_SPEED: perFrame(0.13), // meters/frame
    PULL: perFrame(0.003), // meters/frame^2
    LIFE: toFrames(10_000), // frames
    SPIN: perFrame(0.28), // radians/frame
    RADIUS: 0.07, // meters
    DAMAGE: 15, // hp
    MAX_SHOTS: 20, // shots
    ARM_DISTANCE: 0.3, // meters
  },
  EXPLOSION: {
    LIFE_FRAMES: toFrames(500), // frames
  },
  SHIP: {
    RADIUS: 0.12, // meters
    MASS: 1, // kg
    THRUST_FORCE: 3.6, // newtons
    LINEAR_DAMPING: 1.2, // 1/second
    ANGULAR_DAMPING: 0, // 1/second
    ROTATION_SPEED: perFrame(0.07), // radians/frame
    SHOOT_COOLDOWN: toFrames(250), // frames
    MAX_HP: 100, // hp
    LASER_SHOT_COUNT: 10, // shots
    LASER_TIMER: toFrames(3_333), // frames
    AURA_SHOT_COUNT: 10, // shots
    SHIELD_DURATION: toFrames(40_000), // frames
    HEALTH_BAR_TIMER: toFrames(1_000), // frames
  },
} as const;

export const SCORING = {
  ASTEROID_BASE: 10, // points
  ALIEN: 100, // points
  SHIELD: 50, // points
  LASER: 75, // points
  AURA: 75, // points
  ROCKET: 75, // points
  BOOMERANG: 75, // points
  HEALTH_SMALL: 50, // points
  HEALTH_LARGE: 75, // points
} as const;

export const SHIELD_DAMAGE = {
  BULLET: toFrames(5_000), // frames
  ALIEN_BODY: toFrames(10_000), // frames
  ASTEROID: toFrames(5_000), // frames
} as const;

export const CAT_PLAYER = 1 << 0; // bitmask
export const CAT_ASTEROID = 1 << 1; // bitmask
export const CAT_PLAYER_BULLET = 1 << 2; // bitmask
export const CAT_ENEMY_BULLET = 1 << 3; // bitmask
export const CAT_ENEMY = 1 << 4; // bitmask
export const CAT_PICKUP = 1 << 5; // bitmask
export const CAT_BOOMERANG = 1 << 6; // bitmask
