import type { IPhase, World } from '@vworlds/vecs';
import { Drawable, Shape } from '@spacerocks/common';

export function installShapeDrawSystem(world: World, phase: IPhase): void {
  world
    .system('ShapeDraw')
    .phase(phase)
    .requires(Drawable, Shape)
    .enter([Drawable, Shape], (_entity, [drawable, shape]) => {
      drawable.addStatement(Shape, 55, (ctx) => {
        ctx.beginPath();
        const pts = shape.points;
        if (pts.length > 0) ctx.moveTo(pts[0]!.x, pts[0]!.y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]!.x, pts[i]!.y);
        ctx.closePath();
      });
    })
    .exit([Drawable], (_entity, [drawable]) => {
      drawable.removeStatement(Shape);
    });
}
