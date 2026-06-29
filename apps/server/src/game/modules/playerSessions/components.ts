import { ChildOf, CleanupPolicy, type World } from '@vworlds/vecs';
import { NetworkClient, NetworkInput, Networked } from '@vworlds/vecs-server';
import {
  Body,
  Circle,
  CollisionFilter,
  Damping,
  Force,
  AngularVelocity as PhysicsAngularVelocity,
  LinearVelocity,
  Material,
  Position as PhysicsPosition,
  Rotation as PhysicsRotation,
  Sensor,
  SensorEvents,
} from '@vworlds/vecs-physics';
import {
  DefaultWeapon,
  Health,
  Hyperspace,
  Owner,
  PlayerShip,
  Shield,
  Wraps,
} from '@spacerocks/common';

/**
 * Server-side session record linking a connected client to its player slot.
 */
export class PlayerSession {
  clientId = '';
  playerIndex = 0;
}

/**
 * Per-frame input intent derived from the client's `NetworkInput`. Player
 * control systems read this instead of the raw network input.
 */
export class PlayerInputIntent {
  thrust = false;
  rotateLeft = false;
  rotateRight = false;
  shoot = false;
}

/**
 * Registers every component a player ship + its physics body needs. This
 * includes shared gameplay components (Health, Shield, weapons markers) so
 * that a player-session world is self-contained for tests; other modules
 * re-register idempotently. Physics shape components are registered here
 * because the ship spawns a Circle/Material/Sensor at creation time.
 */
export function registerPlayerSessionComponents(world: World): void {
  world.component(NetworkClient);
  world.component(NetworkInput);
  world.component(PlayerSession);
  world.component(PlayerInputIntent);
  world.component(ChildOf).meta.onDeleteTarget = CleanupPolicy.Delete;
  world.component(Networked);
  world.component(Health);
  world.component(Shield);
  world.component(DefaultWeapon);
  world.component(Owner);
  world.component(Hyperspace);
  world.component(Wraps);
  world.component(PlayerShip);
  world.component(Body);
  world.component(Damping);
  world.component(Force);
  world.component(PhysicsPosition);
  world.component(PhysicsRotation);
  world.component(LinearVelocity);
  world.component(PhysicsAngularVelocity);
  world.component(Circle);
  world.component(Material);
  world.component(Sensor);
  world.component(SensorEvents);
  world.component(CollisionFilter);
}
