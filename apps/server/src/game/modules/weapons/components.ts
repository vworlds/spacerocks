import type { World } from '@vworlds/vecs';
import {
  AuraWeapon,
  Boomerang,
  BoomerangWeapon,
  Bullet,
  Decay,
  DefaultWeapon,
  LaserWeapon,
  Rocket,
  RocketWeapon,
} from '@spacerocks/common';

/**
 * Per-ship shooting cooldown counter (frames remaining until the next shot).
 */
export class ShootingCooldown {
  frames = 0;
}

export function registerWeaponsComponents(world: World): void {
  world.component(ShootingCooldown);
  world.component(LaserWeapon);
  world.component(AuraWeapon);
  world.component(RocketWeapon);
  world.component(BoomerangWeapon);
  world.component(Bullet);
  world.component(Rocket);
  world.component(Boomerang);
  world.component(Decay);
  world.component(DefaultWeapon);
}
