import type { IPhase, World } from '@vworlds/vecs';
import {
  Drawable,
  Position,
  Rotation,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from '@spacerocks/common';
import type { Star } from '../types';

export type RenderTarget = {
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  stars: Star[];
};

export function installRenderSystem(
  world: World,
  phase: IPhase,
  target: RenderTarget,
): void {
  world
    .system('Render')
    .phase(phase)
    .with(Position, Drawable)
    .orderBy([Drawable], (entityA, [a], entityB, [b]) =>
      a.zIndex !== b.zIndex ? a.zIndex - b.zIndex : entityA.eid - entityB.eid,
    )
    .run(() => {
      const { ctx, canvas } = target;
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = 'white';
      for (const star of target.stars) {
        ctx.globalAlpha = star.opacity;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    })
    .each([Position, Drawable], (entity, [pos, drawable]) => {
      const { ctx, canvas } = target;
      const sx = canvas.width / WORLD_WIDTH;
      const sy = canvas.height / WORLD_HEIGHT;
      ctx.save();
      ctx.translate(pos.x * sx, pos.y * sy);
      const rotation = entity.get(Rotation);
      if (rotation) ctx.rotate(rotation.angle);
      ctx.scale(sx, sy);
      drawable.draw(ctx);
      ctx.restore();
    });
}
