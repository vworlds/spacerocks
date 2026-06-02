import type { IPhase, World } from '@vworlds/vecs';
import { Arc, Drawable } from '@spacerocks/common';

export function installArcDrawSystem(world: World, phase: IPhase): void {
  world
    .system('ArcDraw')
    .phase(phase)
    .requires(Drawable, Arc)
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
