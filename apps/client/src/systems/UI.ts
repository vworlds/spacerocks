import { GameStateView } from '@spacerocks/common';
import type { Entity } from '@vworlds/vecs';
import { getVecsClientWorld } from '../network/vecsClient';
import {
  world,
  renderPhase,
  gameState,
  scoreEl,
  waveEl,
  msgEl,
} from '../world';

world
  .system('UI')
  .interval(0.1)
  .phase(renderPhase)
  .run(() => {
    const mirrored = getMirroredGameState();
    const score = mirrored?.score ?? gameState.score;
    const wave = mirrored?.wave ?? gameState.wave;

    if (scoreEl) scoreEl.innerText = `Score: ${score}`;
    if (waveEl) waveEl.innerText = `Wave: ${wave}`;
    if (msgEl && mirrored) msgEl.innerText = mirrored.status;
  });

export function getMirroredGameState(): GameStateView | undefined {
  const clientWorld = getVecsClientWorld();
  if (!clientWorld) return undefined;

  let state: GameStateView | undefined;
  clientWorld.filter([GameStateView]).forEach((entity: Entity) => {
    state ??= entity.get(GameStateView);
  });
  return state;
}
