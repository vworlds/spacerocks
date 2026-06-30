import { Module } from '@vworlds/vecs';
import { Shield, toFrames } from '@spacerocks/common';

const RESPAWN_DELAY_FRAMES = toFrames(3_000);

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
 * Registers the combat components: `Shield` (common) and `RespawnTimer`.
 * `Health` is registered by `playerSessions` (the player-ship components
 * module); combat only uses it.
 */
export class Components extends Module {
  override init(): void {
    this.world.component(Shield);
    this.world.component(RespawnTimer);
  }
}
