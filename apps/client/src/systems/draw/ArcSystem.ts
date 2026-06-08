import { ON_STORE, type World } from '@vworlds/vecs';
import { Arc, Drawable } from '@spacerocks/common';

export function installArcDrawSystem(world: World): void {
  world
    .system('ArcDraw')
    .phase(ON_STORE)
    .with(Drawable, Arc)
    .enter([Drawable, Arc], (_entity, [drawable, arc]) => {
      drawable.addStatement(Arc, 55, (ctx) => {
        ctx.beginPath();
        ctx.arc(0, 0, arc.radius, arc.startAngle, arc.endAngle);
      });
    })
    .exit([Drawable], (_entity, [drawable]) => {
      drawable.removeStatement(Arc);
    });
}
