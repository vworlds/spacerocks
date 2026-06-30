import { Module } from '@vworlds/vecs';

export type PlayerId = 0 | 1;

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
 * Registers player-session components. Physics components are registered by
 * `PhysicsModule`; `NetworkClient`/`NetworkInput` by `ServerWorld`.
 */
export class Components extends Module {
  override init(): void {
    this.world.component(PlayerSession);
    this.world.component(PlayerInputIntent);
  }
}
