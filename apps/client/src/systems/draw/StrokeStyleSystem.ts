import { ON_STORE, type World } from '@vworlds/vecs';
import { Drawable, StrokeStyle } from '@spacerocks/common';

const STROKE_EXEC_KEY = {};

export function installStrokeStyleDrawSystem(world: World): void {
  world
    .system('StrokeStyleDraw')
    .phase(ON_STORE)
    .with(Drawable, StrokeStyle)
    .enter([Drawable, StrokeStyle], (_entity, [drawable, strokeStyle]) => {
      drawable.addStatement(StrokeStyle, 100, (ctx) => {
        ctx.strokeStyle = strokeStyle.style;
        ctx.lineWidth = strokeStyle.lineWidth;
      });
      drawable.addStatement(STROKE_EXEC_KEY, 45, (ctx) => {
        ctx.stroke();
      });
    })
    .exit([Drawable], (_entity, [drawable]) => {
      drawable.removeStatement(StrokeStyle);
      drawable.removeStatement(STROKE_EXEC_KEY);
    });
}
