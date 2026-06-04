export const WORLD_WIDTH = 1024; // world units
export const WORLD_HEIGHT = 768; // world units
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
    SPEED: perFrame(7), // world units/frame
    LIFE: toFrames(1_667), // frames
    DAMAGE: 10, // hp
  },
  ASTEROID: {
    SPEED_FACTOR: perFrame(4), // world units/frame multiplier
  },
  POWERUP: {
    SPEED_FACTOR: perFrame(1), // world units/frame multiplier
    RADIUS: 15, // world units
  },
  ALIEN: {
    RADIUS: 15, // world units
    SPEED_FACTOR: perFrame(2), // world units/frame multiplier
    SHOOT_COOLDOWN_BASE: toFrames(1_000), // frames
    SHOOT_COOLDOWN_RANGE: toFrames(667), // frames
    TARGET_DIST_MAX: 400, // world units
    ASTEROID_AVOID_DIST: 60, // world units
    MAX_HP: 20, // hp
  },
  ROCKET: {
    SPEED: perFrame(5), // world units/frame
    LIFE: toFrames(6_667), // frames
    STRAIGHT_FRAMES: toFrames(500), // frames
    HOME_RANGE: 250, // world units
    TURN_RATE: perFrame(0.08), // radians/frame
    SHOT_COUNT: 5, // shots
    DAMAGE: 20, // hp
  },
  BOOMERANG: {
    SPEED: perFrame(19), // world units/frame
    MAX_SPEED: perFrame(13), // world units/frame
    PULL: perFrame(0.3), // world units/frame^2
    LIFE: toFrames(10_000), // frames
    SPIN: perFrame(0.28), // radians/frame
    RADIUS: 7, // world units
    DAMAGE: 15, // hp
    MAX_SHOTS: 20, // shots
    ARM_DISTANCE: 30, // world units
  },
  EXPLOSION: {
    LIFE_FRAMES: toFrames(500), // frames
  },
  SHIP: {
    RADIUS: 12, // world units
    FRICTION: perFrameMultiplier(0.98), // multiplier/frame
    ROTATION_SPEED: perFrame(0.07), // radians/frame
    THRUST_POWER: perFrame(0.2), // world units/frame^2
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
