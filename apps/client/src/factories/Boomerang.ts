import type { Entity } from '@vworlds/vecs';
import { world } from '../world';
import {
  Position,
  Velocity,
  Rotation,
  AngularVelocity,
  Boomerang,
  BoomerangWeapon,
  Collider,
  Decay,
  Drawable,
  FillStyle,
  Shape,
} from '../components/index';
import {
  CAT_BOOMERANG,
  CAT_ASTEROID,
  CAT_ENEMY,
  CAT_PLAYER,
  ENTITY_CONFIG,
} from '../constants';

export function createBoomerang(
  x: number,
  y: number,
  angle: number,
  owner: Entity,
): void {
  const cfg = ENTITY_CONFIG.BOOMERANG;
  // Spawn just outside the player's catch radius so we don't trigger an
  // immediate self-catch on frame 0. Ship radius (12) + boomerang radius (5).
  const spawnOffset = ENTITY_CONFIG.SHIP.RADIUS + cfg.RADIUS + 4;
  world
    .entity()
    .set(Position, {
      x: x + Math.cos(angle) * spawnOffset,
      y: y + Math.sin(angle) * spawnOffset,
    })
    .set(Velocity, {
      vx: Math.cos(angle) * cfg.SPEED,
      vy: Math.sin(angle) * cfg.SPEED,
    })
    .set(Rotation, { angle })
    .set(AngularVelocity, { omega: cfg.SPIN })
    .set(Boomerang, { ownerId: owner.eid, armed: false })
    .set(Collider, {
      radius: cfg.RADIUS,
      category: CAT_BOOMERANG,
      mask: CAT_ASTEROID | CAT_ENEMY | CAT_PLAYER,
    })
    .set(Decay, { life: 1, decay: 1 / cfg.LIFE })
    .set(Drawable, { zIndex: 20 })
    .set(FillStyle, { style: '#006400' })
    .set(Shape, {
      points: [
        { x: 0, y: 0 },
        { x: 2, y: 5 },
        { x: 5, y: 5 },
        { x: 3, y: 0 },
        { x: 5, y: -5 },
        { x: 2, y: -5 },
      ],
    });
  const weapon = owner.getMut(BoomerangWeapon);
  if (weapon) weapon.inFlight++;
}
