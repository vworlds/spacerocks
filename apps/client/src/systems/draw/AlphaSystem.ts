import type { IPhase, World } from '@vworlds/vecs';
import { Drawable } from '@spacerocks/common';
import { Alpha } from '../../components/Alpha';

const RESTORE_KEY = {};

export function installAlphaDrawSystem(world: World, phase: IPhase): void {
  world
    .system('AlphaDraw')
    .phase(phase)
    .with(Drawable, Alpha)
    .enter([Drawable, Alpha], (_entity, [drawable, alpha]) => {
      let oldAlpha = 1;
      drawable.addStatement(Alpha, 200, (ctx) => {
        oldAlpha = ctx.globalAlpha;
        ctx.globalAlpha = alpha.value;
      });
      drawable.addStatement(RESTORE_KEY, -100, (ctx) => {
        ctx.globalAlpha = oldAlpha;
      });
    })
    .exit([Drawable], (_entity, [drawable]) => {
      drawable.removeStatement(Alpha);
      drawable.removeStatement(RESTORE_KEY);
    });
}
