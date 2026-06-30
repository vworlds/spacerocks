import { Module } from '@vworlds/vecs';
import { toFrames } from '@spacerocks/common';

const RESPAWN_DELAY_FRAMES = toFrames(3_000);

export class Health {
  hp = 100;
  maxHp = 100;
  healthBarTimer = 0;
}

export class Shield {
  shieldTime = 0;
}

/**
 * Per-player respawn countdown. Created by `killPlayer`; the
 * `ServerRespawnSystem` decrements it and respawns the ship when it hits zero.
 */
export class RespawnTimer {
  sessionId = 0;
  playerIndex = 0;
  frames = RESPAWN_DELAY_FRAMES;
}

/**
 * Registers combat-owned components.
 */
export class Components extends Module {
  override init(): void {
    this.world.component(Health);
    this.world.component(Shield);
    this.world.component(RespawnTimer);
  }
}
