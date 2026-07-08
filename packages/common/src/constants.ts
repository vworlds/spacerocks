import type { Price, Production, Maintenance } from './economy';

// ============================================================================
// World / viewport / tick constants (physics, NOT economy)
// ============================================================================

export const PIXELS_PER_METER = 100; // pixels/meter
export const VIEWPORT_WIDTH = 10.24; // meters
export const VIEWPORT_HEIGHT = 7.68; // meters
export const VIEWPORT_MIN_X = -VIEWPORT_WIDTH / 2; // meters
export const VIEWPORT_MAX_X = VIEWPORT_WIDTH / 2; // meters
export const VIEWPORT_MIN_Y = -VIEWPORT_HEIGHT / 2; // meters
export const VIEWPORT_MAX_Y = VIEWPORT_HEIGHT / 2; // meters
export const WORLD_SCALE = 5; // viewports per axis
export const WORLD_WIDTH = VIEWPORT_WIDTH * WORLD_SCALE; // meters
export const WORLD_HEIGHT = VIEWPORT_HEIGHT * WORLD_SCALE; // meters
export const WORLD_MIN_X = -WORLD_WIDTH / 2; // meters
export const WORLD_MAX_X = WORLD_WIDTH / 2; // meters
export const WORLD_MIN_Y = -WORLD_HEIGHT / 2; // meters
export const WORLD_MAX_Y = WORLD_HEIGHT / 2; // meters
export const MAX_ASTEROIDS_TOTAL_MASS = 1800; // kg
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

// ============================================================================
// Collision category bitmasks
// ============================================================================
// Live categories used by surviving player/asteroid/weapon collision filters:
export const CAT_PLAYER = 1 << 0; // bitmask
export const CAT_ASTEROID = 1 << 1; // bitmask
export const CAT_PLAYER_BULLET = 1 << 2; // bitmask
// Legacy categories — still set by surviving collision filters (player/asteroid/weapon factories):
export const CAT_ENEMY_BULLET = 1 << 3; // bitmask
export const CAT_ENEMY = 1 << 4; // bitmask
export const CAT_PICKUP = 1 << 5; // bitmask
export const CAT_BOOMERANG = 1 << 6; // bitmask

// ============================================================================
// Entity physics config (movement, weapons, asteroids — NOT economy)
// ============================================================================

export const ENTITY_CONFIG = {
  BULLET: {
    SPEED: perFrame(0.07), // meters/frame
    LIFE: toFrames(1_667), // frames
    DAMAGE: 10, // hp
  },
  ASTEROID: {
    SPEED_FACTOR: perFrame(0.04), // meters/frame multiplier
    MASS: 16, // kg
    MASS_SIGMA: 1.553512, // log-normal sigma
    MIN_MASS: 2 * 1.1, // kg
    MAX_MASS: 16 * 10, // kg
    DENSITY: 32, // kg/m^2
    MIN_COLLIDABLE_MASS: 2, // kg
    FRAGMENTS: 4, // slices
    MASS_LOSS_RATIO: 0.15, // ratio
    SPLIT_IMPULSE: 1.2, // kg*m/s
    DUST_TTL_FRAMES: toFrames(700), // frames
    VERTICES: 3, // base vertex count (3..6 → 3..6 vertices)
    SPIN: perFrame(0.03), // radians/frame magnitude
  },
  // --- LEGACY entity blocks (retired in place per D5; read only by unplugged
  // --- aliens/pickups modules and by weapons targeting; delete in Epic 8/10) ---
  POWERUP: {
    SPEED_FACTOR: perFrame(0.01), // meters/frame multiplier
    RADIUS: 0.15, // meters
  },
  ALIEN: {
    RADIUS: 0.15, // meters
    MASS: 1, // kg
    SPEED_FACTOR: perFrame(0.02), // meters/frame multiplier
    SHOOT_COOLDOWN_BASE: toFrames(2_500), // frames
    SHOOT_COOLDOWN_RANGE: toFrames(667), // frames
    ROTATION_SPEED: perFrame(0.06), // radians/frame
    FIRE_ANGLE: 0.08, // radians
    TARGET_DIST_MAX: 2.5, // meters
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
  // --- End legacy entity blocks ---
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

// ============================================================================
// LEGACY (retired in place per D5; read only by unplugged aliens/pickups
// modules; delete in Epic 8/10)
// ============================================================================

export const GAME_CONFIG = {
  ALIEN_SPAWN_MIN_WAIT: 5000, // ms
  ALIEN_SPAWN_MAX_WAIT: 12000, // ms
  ALIEN_CAP: 8, // entities

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

export const SHIELD_DAMAGE = {
  BULLET: toFrames(5_000), // frames
  ALIEN_BODY: toFrames(10_000), // frames
  ASTEROID: toFrames(5_000), // frames
} as const;

// ============================================================================
// ECONOMY CONFIG — first-iteration tuning knobs
// ============================================================================
// All Prices are tuples (ore, crystal, alloy). All durations/periods are
// float wall-clock SECONDS — NOT ms, NOT ticks. Do NOT wrap with toFrames/
// perFrame. Balance sweeps are a one-file change (design §2.9/§8.2, plan D8).
//
// Cross-reference table (design #40 sections):
//   Lattice         → §3.1
//   Buildings       → §9, §6.6 (construction), §6.7 (buffers), §6.8 (loot)
//   Ships           → §7.2, §7.5 (captain recruitment)
//   Shields         → §6.4
//   Factory         → §6.7
//   Turret          → §6.7
//   Tugbots/docking → §6.9
//   Cargo/trains    → §5.2 (grab), §5.1 (containers), §6.2 (stack height)
//   Death           → §11.1
//   Placeholders    → E3 (fracture), E4 (train joints)
// ============================================================================

/** Lattice dimensions. Design target 5×5; 2×1 and 1×1 are test modes (§3.1).
 * The default lives here (ENV-FREE); the server may override via
 * LATTICE_COLS / LATTICE_ROWS env vars and pass the resolved dims into the
 * sector world factory. See `resolveLatticeDims()` hook below. */
export const LATTICE = {
  cols: 5,
  rows: 5,
} as const;

/**
 * Resolve lattice dims from the default config, allowing an optional override
 * (e.g. from server-side ENV vars `LATTICE_COLS`/`LATTICE_ROWS`). Kept in
 * `packages/common` so the override logic is testable without importing
 * server-only packages. The server reads env and calls this; the common
 * package itself never touches `process.env`.
 */
export function resolveLatticeDims(
  override?: Partial<{ cols: number; rows: number }>,
): { cols: number; rows: number } {
  return {
    cols: override?.cols ?? LATTICE.cols,
    rows: override?.rows ?? LATTICE.rows,
  };
}

// --- Buildings (§9, §6.6, §6.7, §6.8) -----------------------------------------

export type BuildingType =
  | 'main'
  | 'shieldGenerator'
  | 'factory'
  | 'shipyard'
  | 'turret'
  | 'dockingStation';

/** Construction config per building type (§9). `price` is the Construction
 * Price (atomic, paid by the construction site); `segments` is the surface-
 * grid footprint; `duration` is reserved (§6.6: construction is Price-only,
 * no post-delivery timer; default 0). Main is pre-built (no price). */
export const BUILDINGS: Record<
  BuildingType,
  {
    segments: number;
    price: Price;
    /** Reserved construction timer (§6.6). Default 0 = instant on full Price. */
    duration: number;
  }
> = {
  main: {
    segments: 3,
    price: { ore: 0, crystal: 0, alloy: 0 },
    duration: 0,
  },
  shieldGenerator: {
    segments: 1,
    price: { ore: 2, crystal: 0, alloy: 0 },
    duration: 0,
  },
  factory: {
    segments: 2,
    price: { ore: 2, crystal: 1, alloy: 0 },
    duration: 0,
  },
  shipyard: {
    segments: 3,
    price: { ore: 0, crystal: 0, alloy: 3 },
    duration: 0,
  },
  turret: {
    segments: 1,
    price: { ore: 1, crystal: 0, alloy: 0 },
    duration: 0,
  },
  dockingStation: {
    segments: 2,
    price: { ore: 2, crystal: 0, alloy: 0 },
    duration: 0,
  },
} as const;

/** Seed production config (§6.6). Every seed type: price (1,0,0), 5s. */
export const SEEDS: Record<Exclude<BuildingType, 'main'>, Production> = {
  shieldGenerator: { price: { ore: 1, crystal: 0, alloy: 0 }, duration: 5 },
  factory: { price: { ore: 1, crystal: 0, alloy: 0 }, duration: 5 },
  shipyard: { price: { ore: 1, crystal: 0, alloy: 0 }, duration: 5 },
  turret: { price: { ore: 1, crystal: 0, alloy: 0 }, duration: 5 },
  dockingStation: { price: { ore: 1, crystal: 0, alloy: 0 }, duration: 5 },
} as const;

// --- Ship catalog (§7.2, §7.5) -----------------------------------------------

export type ShipType =
  'allRounder' | 'fighter' | 'miner' | 'tug' | 'captain' | 'tugbot';

/** Ship catalog (§7.2). `price`/`duration` is the Production cost at the
 * shipyard (all-rounder is respawn-only: price 0, duration = death timer).
 * `trainLimit` is the max train length. `hyperdrive` = can cross sectors. */
export const SHIPS: Record<
  ShipType,
  {
    price: Price;
    /** Float wall-clock seconds. */
    duration: number;
    trainLimit: number;
    hyperdrive: boolean;
  }
> = {
  allRounder: {
    price: { ore: 0, crystal: 0, alloy: 0 },
    duration: 5,
    trainLimit: 3,
    hyperdrive: true,
  },
  fighter: {
    price: { ore: 1, crystal: 0, alloy: 1 },
    duration: 20,
    trainLimit: 0,
    hyperdrive: true,
  },
  miner: {
    price: { ore: 2, crystal: 0, alloy: 1 },
    duration: 25,
    trainLimit: 3,
    hyperdrive: true,
  },
  tug: {
    price: { ore: 1, crystal: 0, alloy: 2 },
    duration: 25,
    trainLimit: 6,
    hyperdrive: true,
  },
  captain: {
    price: { ore: 0, crystal: 2, alloy: 3 },
    duration: 40,
    trainLimit: 0,
    hyperdrive: true,
  },
  tugbot: {
    price: { ore: 1, crystal: 0, alloy: 0 },
    duration: 8,
    trainLimit: 1,
    hyperdrive: false,
  },
} as const;

/** Captain auto-recruitment radius (§7.5): a captain with free slots recruits
 * unassigned fighters within this radius. */
export const CAPTAIN_RECRUITMENT_RADIUS = 3; // meters

// --- Shields (§6.4) ----------------------------------------------------------

export const SHIELDS = {
  /** Max HP of a shield bubble. */
  maxHp: 100, // hp
  /** Crystal buffer size (slots) — the 5-slot Crystal buffer (§6.4). */
  bufferSize: 5, // slots
  /** Standard maintenance: deduct (0,1,0) Crystal every `period` seconds.
   * If unpayable, the bubble drops until Crystal flows again. */
  maintenance: {
    price: { ore: 0, crystal: 1, alloy: 0 },
    period: 300, // seconds (5 min)
  } satisfies Maintenance,
  /** Recharge: while below max HP, regenerates at `rate` hp/s, consuming
   * (0,1,0) Crystal every `period` seconds. Without Crystal, stays damaged. */
  recharge: {
    price: { ore: 0, crystal: 1, alloy: 0 },
    period: 300, // seconds
    rate: 2, // hp/s
  },
  /** The Main building's built-in generator runs at a more efficient
   * maintenance rate (§6.4): with a 5-Crystal buffer, ≈30 min of grace.
   * This is the period between maintenance drains for the Main's generator. */
  mainEfficientMaintenancePeriod: 360, // seconds (6 min → 5 × 6 = 30 min grace)
} as const;

// --- Factory recipe (§6.7) ----------------------------------------------------

export const FACTORY_RECIPE: Production = {
  price: { ore: 2, crystal: 1, alloy: 0 },
  duration: 10,
} as const;

// --- Turret (§6.7) ------------------------------------------------------------

export const TURRET = {
  /** Ammo buffer size in Ore slots. */
  ammoBufferSlots: 5, // slots
  /** 1 Ore = this many shots (instant conversion, duration 0). */
  shotsPerOre: 5, // shots
  /** Production duration for ammo conversion (§6.7: instant, duration 0). */
  ammoDuration: 0, // seconds
  /** Max shots loaded at once. */
  maxShots: 25, // shots
  /** Targeting range. */
  range: 5, // meters
} as const;

// --- Tugbots & docking stations (§6.9) ---------------------------------------

export const TUGBOT = {
  /** Influence radius for docking stations and the main building (§6.9). */
  influenceRadius: 10, // meters
  /** Max tugbots fielded per docking station / main building (§6.9). */
  maxPerStation: 5, // tugbots
} as const;

// --- Cargo, containers, stacks (§5.1, §5.2, §6.2, §6.8) ----------------------

export const CARGO = {
  /** Default building input-buffer size per resource type (§6.7: ~5 units). */
  defaultBufferSlots: 5, // slots
  /** Maximum stack height (§6.2). */
  maxStackHeight: 5, // containers
  /** Grab toggle default (§5.2: default ON). */
  grabDefaultOn: true,
} as const;

// --- Death (§11.1) ------------------------------------------------------------

export const DEATH = {
  /** Death timer before respawn at the main building (§11.1). */
  timer: 5, // float wall-clock seconds
} as const;

// --- Building loot (§6.8) -----------------------------------------------------

export const BUILDING_LOOT = {
  /** Fraction of the Construction Price released as containers on destruction
   * (§6.8: default 50% per resource, rounded down). */
  buildingLootRatio: 0.5,
  /** Fraction of buffered operational resources released (§6.8: 40%). */
  bufferedLootRatio: 0.4,
} as const;

// --- Placeholder knobs for later epics (clearly marked) ----------------------
// These exist so later epics have a config home from day one. They are NOT
// read by any first-iteration system and have no effect yet.

/** Placeholder: fracture meter fill/decay rates (E3 — mining). */
export const PLACEHOLDER_FRACTURE_METER = {
  fillRate: 0, // placeholder, tuned in E3
  decayRate: 0, // placeholder, tuned in E3
} as const;

/** Placeholder: train joint stiffness/damping (E4 — cargo trains). */
export const PLACEHOLDER_TRAIN_JOINT = {
  stiffness: 0, // placeholder, tuned in E4
  damping: 0, // placeholder, tuned in E4
} as const;
