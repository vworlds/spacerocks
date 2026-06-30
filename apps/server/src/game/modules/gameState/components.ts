import { Module } from '@vworlds/vecs';
import { GameStateView } from '@spacerocks/common';

/**
 * Registers the networked `GameStateView` component (defined in
 * `@spacerocks/common`). The {@link GameStateModule} creates the single
 * game-state entity; helpers in `./helpers` read/update it.
 */
export class Components extends Module {
  override init(): void {
    this.world.component(GameStateView);
  }
}

export { GameStateView } from '@spacerocks/common';
