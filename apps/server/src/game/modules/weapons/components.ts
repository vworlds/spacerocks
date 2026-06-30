import { Module } from '@vworlds/vecs';
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

/**
 * Registers the weapon/projectile components: `ShootingCooldown` (local) and
 * the common weapon markers + projectile types + `Decay`.
 */
export class Components extends Module {
  override init(): void {
    this.world.component(ShootingCooldown);
    this.world.component(LaserWeapon);
    this.world.component(AuraWeapon);
    this.world.component(RocketWeapon);
    this.world.component(BoomerangWeapon);
    this.world.component(Bullet);
    this.world.component(Rocket);
    this.world.component(Boomerang);
    this.world.component(Decay);
    this.world.component(DefaultWeapon);
  }
}
