import type { ServerWorld } from '@vworlds/vecs-server';
import {
  AngularVelocity,
  ENTITY_CONFIG,
  Friction,
  PlayerShip,
  Position,
  Rotation,
  Thrust,
  Velocity,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  Wraps,
} from '@spacerocks/common';
import { PlayerInputIntent } from './playerSessions';

export function installMovementSystems(world: ServerWorld): void {
  world
    .system('ShipControl')
    .with(PlayerShip, PlayerInputIntent, Rotation, Thrust)
    .each(
      [PlayerInputIntent, Rotation, Thrust],
      (entity, [input, rotation, thrust]) => {
        if (input.rotateLeft) {
          rotation.angle -= ENTITY_CONFIG.SHIP.ROTATION_SPEED;
          entity.modified(Rotation);
        }
        if (input.rotateRight) {
          rotation.angle += ENTITY_CONFIG.SHIP.ROTATION_SPEED;
          entity.modified(Rotation);
        }
        thrust.active = input.thrust;
      },
    );

  world
    .system('Thrust')
    .with(Velocity, Thrust, Rotation)
    .each(
      [Velocity, Thrust, Rotation],
      (_entity, [velocity, thrust, rotation]) => {
        if (!thrust.active) return;

        velocity.vx += Math.cos(rotation.angle) * thrust.force;
        velocity.vy += Math.sin(rotation.angle) * thrust.force;
        thrust.active = false;
      },
    );

  world
    .system('Movement')
    .with(Position, Velocity)
    .each([Position, Velocity], (entity, [position, velocity]) => {
      position.x += velocity.vx;
      position.y += velocity.vy;
      entity.modified(Position);
    });

  world
    .system('AngularMovement')
    .with(Rotation, AngularVelocity)
    .each(
      [Rotation, AngularVelocity],
      (entity, [rotation, angularVelocity]) => {
        rotation.angle += angularVelocity.omega;
        entity.modified(Rotation);
      },
    );

  world
    .system('FrictionSystem')
    .with(Velocity, Friction)
    .each([Velocity, Friction], (_entity, [velocity, friction]) => {
      velocity.vx *= friction.value;
      velocity.vy *= friction.value;
    });

  world
    .system('Wrap')
    .with(Position, Wraps)
    .each([Position], (entity, [position]) => {
      let wrapped = false;

      if (position.x < 0) {
        position.x = WORLD_WIDTH;
        wrapped = true;
      } else if (position.x > WORLD_WIDTH) {
        position.x = 0;
        wrapped = true;
      }

      if (position.y < 0) {
        position.y = WORLD_HEIGHT;
        wrapped = true;
      } else if (position.y > WORLD_HEIGHT) {
        position.y = 0;
        wrapped = true;
      }

      if (wrapped) entity.modified(Position);
    });
}
