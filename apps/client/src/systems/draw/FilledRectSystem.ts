import type { IPhase, World } from '@vworlds/vecs';
import { Drawable, FilledRect } from '@spacerocks/common';

export function installFilledRectDrawSystem(world: World, phase: IPhase): void {
  world
    .system('FilledRectDraw')
    .phase(phase)
    .requires(Drawable, FilledRect)
    .enter([Drawable, FilledRect], (_entity, [drawable, rect]) => {
      drawable.addStatement(FilledRect, 50, (ctx) => {
        ctx.fillRect(
          -rect.width / 2,
          -rect.height / 2,
          rect.width,
          rect.height,
        );
      });
    })
    .exit([Drawable], (_entity, [drawable]) => {
      drawable.removeStatement(FilledRect);
    });
}
