import { ON_STORE, type World } from '@vworlds/vecs';
import { Drawable, FillStyle } from '@spacerocks/common';

const FILL_EXEC_KEY = {};

export function installFillStyleDrawSystem(world: World): void {
  world
    .system('FillStyleDraw')
    .phase(ON_STORE)
    .with(Drawable, FillStyle)
    .enter([Drawable, FillStyle], (_entity, [drawable, fillStyle]) => {
      drawable.addStatement(FillStyle, 100, (ctx) => {
        ctx.fillStyle = fillStyle.style;
      });
      drawable.addStatement(FILL_EXEC_KEY, 45, (ctx) => {
        ctx.fill();
      });
    })
    .exit([Drawable], (_entity, [drawable]) => {
      drawable.removeStatement(FillStyle);
      drawable.removeStatement(FILL_EXEC_KEY);
    });
}
