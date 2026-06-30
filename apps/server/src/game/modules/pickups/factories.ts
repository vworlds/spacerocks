import { type Entity, type World } from '@vworlds/vecs';
import { Networked } from '@vworlds/vecs-server';
import {
  Arc,
  Position as RenderPosition,
  StrokeStyle,
} from '@vworlds/vecs-phaser';
import {
  Body,
  BodyType,
  Circle,
  CollisionFilter,
  LinearVelocity,
  Position as PhysicsPosition,
  Sensor,
  SensorEvents,
} from '@vworlds/vecs-physics';
import {
  CAT_PICKUP,
  CAT_PLAYER,
  Decay,
  ENTITY_CONFIG,
  HealthPickup,
  PICKUP_COLORS,
  Pickup,
  PickupKind,
  perSecond,
  Wraps,
  WORLD_MAX_X,
  WORLD_MAX_Y,
  WORLD_MIN_X,
  WORLD_MIN_Y,
} from '@spacerocks/common';
import { GAME_CONFIG } from '@spacerocks/common';
import type { Prng } from '../rng/components';

const PICKUP_TTL_FRAMES: Record<PickupKind, number> = {
  [PickupKind.Shield]: GAME_CONFIG.SHIELD_PICKUP_TTL_FRAMES,
  [PickupKind.Laser]: GAME_CONFIG.LASER_PICKUP_TTL_FRAMES,
  [PickupKind.Aura]: GAME_CONFIG.AURA_PICKUP_TTL_FRAMES,
  [PickupKind.Rocket]: GAME_CONFIG.ROCKET_PICKUP_TTL_FRAMES,
  [PickupKind.Boomerang]: GAME_CONFIG.BOOMERANG_PICKUP_TTL_FRAMES,
  [PickupKind.Health]: GAME_CONFIG.HEALTH_PICKUP_TTL_FRAMES,
};

export function createPickup(
  world: World,
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
  world: World,
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
    .set(CollisionFilter, { categoryBits, maskBits });
}
