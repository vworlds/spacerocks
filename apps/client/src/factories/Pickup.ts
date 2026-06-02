import type { Entity } from '@vworlds/vecs';
import { world, canvasSize, gameState } from '../world';
import {
  Position,
  Velocity,
  Pickup,
  HealthPickup,
  Collider,
  Drawable,
  Arc,
  StrokeStyle,
  Label,
  Wraps,
  LaserWeapon,
  AuraWeapon,
  RocketWeapon,
  BoomerangWeapon,
  Shield,
  Health,
  Decay,
  PickupKind,
} from '../components/index';
import {
  CAT_PICKUP,
  CAT_PLAYER,
  ENTITY_CONFIG,
  GAME_CONFIG,
  SCORING,
} from '../constants';

type PickupType = PickupKind;

const PICKUP_TTL_FRAMES: Record<PickupType, number> = {
  [PickupKind.Shield]: GAME_CONFIG.SHIELD_PICKUP_TTL_FRAMES,
  [PickupKind.Laser]: GAME_CONFIG.LASER_PICKUP_TTL_FRAMES,
  [PickupKind.Aura]: GAME_CONFIG.AURA_PICKUP_TTL_FRAMES,
  [PickupKind.Rocket]: GAME_CONFIG.ROCKET_PICKUP_TTL_FRAMES,
  [PickupKind.Boomerang]: GAME_CONFIG.BOOMERANG_PICKUP_TTL_FRAMES,
  [PickupKind.Health]: GAME_CONFIG.HEALTH_PICKUP_TTL_FRAMES,
};

const PICKUP_CONFIG: Record<PickupType, { color: string; label: string }> = {
  [PickupKind.Shield]: { color: '#0f0', label: 'S' },
  [PickupKind.Laser]: { color: '#f00', label: 'L' },
  [PickupKind.Aura]: { color: '#3af', label: 'A' },
  [PickupKind.Rocket]: { color: '#ff6600', label: 'R' },
  [PickupKind.Boomerang]: { color: '#006400', label: 'B' },
  [PickupKind.Health]: { color: '#fff', label: '' },
};

export function applyPickupEffect(picker: Entity, source: Entity): void {
  const pickup = source.get(Pickup);
  if (!pickup) return;

  if (pickup.kind === PickupKind.Shield) {
    picker.set(Shield, { shieldTime: ENTITY_CONFIG.SHIP.SHIELD_DURATION });
    gameState.score += SCORING.SHIELD;
  } else if (pickup.kind === PickupKind.Laser) {
    picker.set(LaserWeapon, {
      shots: ENTITY_CONFIG.SHIP.LASER_SHOT_COUNT,
      firing: false,
      timer: 0,
    });
    gameState.score += SCORING.LASER;
  } else if (pickup.kind === PickupKind.Aura) {
    picker.set(AuraWeapon, { shots: ENTITY_CONFIG.SHIP.AURA_SHOT_COUNT });
    gameState.score += SCORING.AURA;
  } else if (pickup.kind === PickupKind.Rocket) {
    picker.set(RocketWeapon, { shots: ENTITY_CONFIG.ROCKET.SHOT_COUNT });
    gameState.score += SCORING.ROCKET;
  } else if (pickup.kind === PickupKind.Boomerang) {
    picker.set(BoomerangWeapon, {
      shots: ENTITY_CONFIG.BOOMERANG.MAX_SHOTS,
      inFlight: 0,
    });
    gameState.score += SCORING.BOOMERANG;
  } else {
    const hp = source.get(HealthPickup)!;
    const health = picker.getMut(Health);
    if (health) {
      health.hp = Math.min(health.hp + health.maxHp * hp.amount, health.maxHp);
      health.healthBarTimer = ENTITY_CONFIG.SHIP.HEALTH_BAR_TIMER;
    }
    gameState.score +=
      hp.amount <= 0.25 ? SCORING.HEALTH_SMALL : SCORING.HEALTH_LARGE;
  }
}

export function createPickup(type: PickupType | `${PickupKind}`): void {
  const kind = type as PickupKind;
  const cfg = PICKUP_CONFIG[kind] ?? PICKUP_CONFIG[PickupKind.Shield];

  const amount =
    kind === PickupKind.Health ? (Math.random() < 0.5 ? 0.25 : 0.5) : 0;
  const label =
    kind === PickupKind.Health ? (amount <= 0.25 ? '+' : '++') : cfg.label;

  const entity = world
    .entity()
    .set(Position, {
      x: Math.random() * canvasSize.width,
      y: Math.random() * canvasSize.height,
    })
    .set(Velocity, {
      vx: (Math.random() - 0.5) * ENTITY_CONFIG.POWERUP.SPEED_FACTOR,
      vy: (Math.random() - 0.5) * ENTITY_CONFIG.POWERUP.SPEED_FACTOR,
    })
    .set(Pickup, { kind })
    .set(Decay, {
      life: 1,
      decay:
        1 / (PICKUP_TTL_FRAMES[kind] ?? PICKUP_TTL_FRAMES[PickupKind.Shield]),
    })
    .set(Collider, {
      radius: ENTITY_CONFIG.POWERUP.RADIUS,
      category: CAT_PICKUP,
      mask: CAT_PLAYER,
    })
    .set(Drawable, { zIndex: 50 })
    .add(Wraps)
    .set(StrokeStyle, { style: cfg.color, lineWidth: 2 })
    .set(Arc, { radius: ENTITY_CONFIG.POWERUP.RADIUS })
    .set(Label, { text: label, color: cfg.color });

  if (kind === PickupKind.Health) {
    entity.set(HealthPickup, { amount });
  }
}
