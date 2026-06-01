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
} from '../components/index';
import {
  CAT_PICKUP,
  CAT_PLAYER,
  ENTITY_CONFIG,
  GAME_CONFIG,
  SCORING,
} from '../constants';

type PickupType =
  | 'shield'
  | 'laser'
  | 'aura'
  | 'rocket'
  | 'boomerang'
  | 'health';

const PICKUP_TTL_FRAMES: Record<PickupType, number> = {
  shield: GAME_CONFIG.SHIELD_PICKUP_TTL_FRAMES,
  laser: GAME_CONFIG.LASER_PICKUP_TTL_FRAMES,
  aura: GAME_CONFIG.AURA_PICKUP_TTL_FRAMES,
  rocket: GAME_CONFIG.ROCKET_PICKUP_TTL_FRAMES,
  boomerang: GAME_CONFIG.BOOMERANG_PICKUP_TTL_FRAMES,
  health: GAME_CONFIG.HEALTH_PICKUP_TTL_FRAMES,
};

const PICKUP_CONFIG: Record<PickupType, { color: string; label: string }> = {
  shield: { color: '#0f0', label: 'S' },
  laser: { color: '#f00', label: 'L' },
  aura: { color: '#3af', label: 'A' },
  rocket: { color: '#ff6600', label: 'R' },
  boomerang: { color: '#006400', label: 'B' },
  health: { color: '#fff', label: '' }, // label set dynamically per variant
};

function makeEffectFunc(
  type: PickupType,
): (picker: Entity, source: Entity) => void {
  return (picker: Entity, source: Entity) => {
    if (type === 'shield') {
      picker.set(Shield, { shieldTime: ENTITY_CONFIG.SHIP.SHIELD_DURATION });
      gameState.score += SCORING.SHIELD;
    } else if (type === 'laser') {
      picker.set(LaserWeapon, {
        shots: ENTITY_CONFIG.SHIP.LASER_SHOT_COUNT,
        firing: false,
        timer: 0,
      });
      gameState.score += SCORING.LASER;
    } else if (type === 'aura') {
      picker.set(AuraWeapon, { shots: ENTITY_CONFIG.SHIP.AURA_SHOT_COUNT });
      gameState.score += SCORING.AURA;
    } else if (type === 'rocket') {
      picker.set(RocketWeapon, { shots: ENTITY_CONFIG.ROCKET.SHOT_COUNT });
      gameState.score += SCORING.ROCKET;
    } else if (type === 'boomerang') {
      picker.set(BoomerangWeapon, {
        shots: ENTITY_CONFIG.BOOMERANG.MAX_SHOTS,
      });
      gameState.score += SCORING.BOOMERANG;
    } else {
      const hp = source.get(HealthPickup)!;
      const health = picker.getMut(Health);
      if (health) {
        health.hp = Math.min(
          health.hp + health.maxHp * hp.amount,
          health.maxHp,
        );
        health.healthBarTimer = ENTITY_CONFIG.SHIP.HEALTH_BAR_TIMER;
      }
      gameState.score +=
        hp.amount <= 0.25 ? SCORING.HEALTH_SMALL : SCORING.HEALTH_LARGE;
    }
  };
}

export function createPickup(type: PickupType): void {
  const cfg = PICKUP_CONFIG[type];

  const amount = type === 'health' ? (Math.random() < 0.5 ? 0.25 : 0.5) : 0;
  const label = type === 'health' ? (amount <= 0.25 ? '+' : '++') : cfg.label;

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
    .set(Pickup, { effectFunc: makeEffectFunc(type) })
    .set(Decay, { life: 1, decay: 1 / PICKUP_TTL_FRAMES[type] })
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

  if (type === 'health') {
    entity.set(HealthPickup, { amount });
  }
}
