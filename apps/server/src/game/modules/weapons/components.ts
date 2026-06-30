import { Module } from '@vworlds/vecs';

/**
 * Per-ship shooting cooldown counter (frames remaining until the next shot).
 */
export class ShootingCooldown {
  frames = 0;
}

/**
 * Registers the `ShootingCooldown` component. Weapon/projectile components
 * (`LaserWeapon`, `Bullet`, `Decay`, etc.) are registered by
 * `NetworkComponentsModule`.
 */
export class Components extends Module {
  override init(): void {
    this.world.component(ShootingCooldown);
  }
}
