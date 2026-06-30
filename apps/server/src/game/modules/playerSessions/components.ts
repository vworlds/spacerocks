import { ChildOf, CleanupPolicy, Module } from '@vworlds/vecs';
import { NetworkClient, NetworkInput } from '@vworlds/vecs-server';
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
 * Registers the player-session components and the common ship gameplay
 * components a player ship needs (Health, Shield, DefaultWeapon, etc.).
 * Physics body/shape components are registered by `PhysicsModule`; network
 * components by the network world / `NetworkComponentsModule`.
 */
export class Components extends Module {
  override init(): void {
    this.world.component(NetworkClient);
    this.world.component(NetworkInput);
    this.world.component(PlayerSession);
    this.world.component(PlayerInputIntent);
    this.world.component(PlayerShip);
    this.world.component(Health);
    this.world.component(Shield);
    this.world.component(DefaultWeapon);
    this.world.component(Wraps);
    this.world.component(Owner);
    this.world.component(Hyperspace);
    // ChildOf is the built-in parent relationship; configure cascade-delete so
    // destroying a parent (session/client) removes its children (ship/shapes).
    this.world.component(ChildOf).meta.onDeleteTarget = CleanupPolicy.Delete;
  }
}
