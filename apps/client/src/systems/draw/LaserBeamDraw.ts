import type { IPhase, World } from '@vworlds/vecs';
import { Drawable, WORLD_WIDTH, WeaponView } from '@spacerocks/common';

const WEAPON_KIND_LASER = 1; // enum id

export function installLaserBeamDrawSystem(world: World, phase: IPhase): void {
  world
    .system('LaserBeamDraw')
    .phase(phase)
    .with(Drawable, WeaponView)
    .enter([Drawable], (entity, [drawable]) => {
      drawable.addStatement(WeaponView, 160, (ctx) => {
        const weapon = entity.get(WeaponView);
        if (
          !weapon ||
          weapon.activeWeapon !== WEAPON_KIND_LASER ||
          weapon.firing === 0
        ) {
          return;
        }
        ctx.beginPath();
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 4;
        ctx.moveTo(0, 0);
        ctx.lineTo(WORLD_WIDTH, 0);
        ctx.stroke();
      });
    })
    .exit([Drawable], (_entity, [drawable]) => {
      drawable.removeStatement(WeaponView);
    });
}
