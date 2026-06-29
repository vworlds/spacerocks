import type { World } from '@vworlds/vecs';
import { GameStateView } from '@spacerocks/common';

/**
 * Registers the networked `GameStateView` component (defined in
 * `@spacerocks/common`). The {@link GameStateModule} also creates the singleton
 * game-state entity.
 */
export function registerGameStateComponents(world: World): void {
  world.component(GameStateView);
}

export { GameStateView } from '@spacerocks/common';
