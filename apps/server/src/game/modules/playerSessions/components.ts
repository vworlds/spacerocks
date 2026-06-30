import { ChildOf, CleanupPolicy, Module } from '@vworlds/vecs';

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
 * Registers the player-session components (`PlayerSession`,
 * `PlayerInputIntent`) and configures the built-in `ChildOf` relationship's
 * cleanup policy (cascade-delete so destroying a parent removes its children).
 * Common ship gameplay components (`PlayerShip`, `Health`, `Shield`, etc.)
 * are registered by `NetworkComponentsModule`; physics components by
 * `PhysicsModule`; `NetworkClient`/`NetworkInput` by `@vworlds/vecs-server`'s
 * `ServerWorld`.
 */
export class Components extends Module {
  override init(): void {
    this.world.component(PlayerSession);
    this.world.component(PlayerInputIntent);
    this.world.component(ChildOf).meta.onDeleteTarget = CleanupPolicy.Delete;
  }
}
