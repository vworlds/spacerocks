import { POST_UPDATE } from '@vworlds/vecs';
import type { ServerWorld } from '@vworlds/vecs-server';
import {
  LinearVelocity,
  Position as PhysicsPosition,
  Rotation as PhysicsRotation,
} from '@vworlds/vecs-physics';
import {
  ENTITY_CONFIG,
  PlayerShip,
  WORLD_MAX_X,
  WORLD_MAX_Y,
  WORLD_MIN_X,
  WORLD_MIN_Y,
  Wraps,
} from '@spacerocks/common';
import { PlayerInputIntent } from './playerSessions';

export function installMovementSystems(world: ServerWorld): void {
  world
    .system('ShipControl')
    .with(PlayerShip, PlayerInputIntent, PhysicsRotation, LinearVelocity)
    .each(
      [PlayerInputIntent, PhysicsRotation, LinearVelocity],
      (entity, [input, rotation, linearVelocity]) => {
        // Server coords are +y-up; CoordSpace.rot negates angles for Phaser,
        // so increasing Rotation.angle renders visual CCW, i.e. Asteroids-left.
        if (input.rotateLeft) {
          rotation.angle += ENTITY_CONFIG.SHIP.ROTATION_SPEED;
          entity.modified(PhysicsRotation);
        }
        if (input.rotateRight) {
          rotation.angle -= ENTITY_CONFIG.SHIP.ROTATION_SPEED;
          entity.modified(PhysicsRotation);
        }

        if (input.thrust) {
          linearVelocity.x +=
            Math.cos(rotation.angle) * ENTITY_CONFIG.SHIP.THRUST_POWER;
          linearVelocity.y +=
            Math.sin(rotation.angle) * ENTITY_CONFIG.SHIP.THRUST_POWER;
          entity.modified(LinearVelocity);
        }
      },
    );

  world
    .system('ShipFriction')
    .with(PlayerShip, LinearVelocity)
    .each([LinearVelocity], (entity, [linearVelocity]) => {
      linearVelocity.x *= ENTITY_CONFIG.SHIP.FRICTION;
      linearVelocity.y *= ENTITY_CONFIG.SHIP.FRICTION;
      entity.modified(LinearVelocity);
    });

  world
    .system('Wrap')
    .phase(POST_UPDATE)
    .with(PhysicsPosition, Wraps)
    .each([PhysicsPosition], (entity, [position]) => {
      let wrapped = false;

      if (position.x < WORLD_MIN_X) {
        position.x = WORLD_MAX_X;
        wrapped = true;
      } else if (position.x > WORLD_MAX_X) {
        position.x = WORLD_MIN_X;
        wrapped = true;
      }

      if (position.y < WORLD_MIN_Y) {
        position.y = WORLD_MAX_Y;
        wrapped = true;
      } else if (position.y > WORLD_MAX_Y) {
        position.y = WORLD_MIN_Y;
        wrapped = true;
      }

      if (wrapped) entity.modified(PhysicsPosition);
    });
}
