import { ON_STORE, type World } from '@vworlds/vecs';
import { Drawable, ENTITY_CONFIG, HealthView } from '@spacerocks/common';

const BAR_WIDTH = 30; // pixels
const BAR_HEIGHT = 5; // pixels

export function installHealthDrawSystem(world: World): void {
  world
    .system('HealthDraw')
    .phase(ON_STORE)
    .with(Drawable, HealthView)
    .enter([Drawable], (entity, [drawable]) => {
      drawable.addStatement(HealthView, 70, (ctx) => {
        const health = entity.get(HealthView);
        if (!health || health.barTimer <= 0 || health.maxHp <= 0) return;
        const ratio = Math.max(0, Math.min(1, health.hp / health.maxHp));
        const x = -BAR_WIDTH / 2;
        const y = -ENTITY_CONFIG.SHIP.RADIUS - 15;
        ctx.strokeStyle = '#0f0';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, BAR_WIDTH, BAR_HEIGHT);
        ctx.fillStyle =
          health.hp <= 33 ? '#f00' : health.hp <= 66 ? '#ff0' : '#0f0';
        ctx.fillRect(x, y, BAR_WIDTH * ratio, BAR_HEIGHT);
      });
    })
    .exit([Drawable], (_entity, [drawable]) => {
      drawable.removeStatement(HealthView);
    });
}
