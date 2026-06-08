import { ON_STORE, type World } from '@vworlds/vecs';
import { Drawable, ENTITY_CONFIG, ShieldView } from '@spacerocks/common';

export function installShieldDrawSystem(world: World): void {
  world
    .system('ShieldDraw')
    .phase(ON_STORE)
    .with(Drawable, ShieldView)
    .enter([Drawable], (entity, [drawable]) => {
      drawable.addStatement(ShieldView, 150, (ctx) => {
        const shield = entity.get(ShieldView);
        if (!shield || shield.remainingTime <= 0) return;
        const progress =
          shield.remainingTime / ENTITY_CONFIG.SHIP.SHIELD_DURATION;
        let r: number;
        let g: number;
        if (progress >= 0.5) {
          const t = (1 - progress) * 2;
          r = Math.floor(255 * t);
          g = 255;
        } else {
          const t = (0.5 - progress) * 2;
          r = 255;
          g = Math.floor(255 * (1 - t));
        }
        ctx.beginPath();
        ctx.strokeStyle = `rgb(${r},${g},0)`;
        ctx.lineWidth = 3;
        ctx.arc(0, 0, ENTITY_CONFIG.SHIP.RADIUS + 8, 0, Math.PI * 2);
        ctx.stroke();
      });
    })
    .exit([Drawable], (_entity, [drawable]) => {
      drawable.removeStatement(ShieldView);
    });
}
