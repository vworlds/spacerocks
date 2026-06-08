import { ON_STORE, type World } from '@vworlds/vecs';
import { GameStateView } from '@spacerocks/common';

export type UITargets = {
  scoreEl: HTMLElement;
  waveEl: HTMLElement;
  msgEl: HTMLElement;
};

export function installUISystem(world: World, targets: UITargets): void {
  world
    .system('UI')
    .phase(ON_STORE)
    .interval(0.1)
    .with(GameStateView)
    .each([GameStateView], (_entity, [view]) => {
      targets.scoreEl.innerText = `Score: ${view.score}`;
      targets.waveEl.innerText = `Wave: ${view.wave}`;
      targets.msgEl.innerText = view.status;
    });
}
