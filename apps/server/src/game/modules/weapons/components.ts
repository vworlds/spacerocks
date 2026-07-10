import { Module } from '@vworlds/vecs';

export type OwnerType = 'player' | 'alien';

export class AuraWeapon {
  shots = 0;
}

export class RocketWeapon {
  shots = 0;
}

export class BoomerangWeapon {
  shots = 0;
  inFlight = 0;
}

export class DefaultWeapon {}

export class Bullet {
  ownerType: OwnerType = 'player';
}

export class Rocket {
  straightTimer = 0;
}

export class Boomerang {
  ownerId: number | null = null;
  armed = false;
}

/**
 * Per-ship shooting cooldown counter (frames remaining until the next shot).
 */
export class ShootingCooldown {
  frames = 0;
}

/**
 * Registers weapon/projectile components.
 */
export class Components extends Module {
  override init(): void {
    this.world.component(AuraWeapon);
    this.world.component(RocketWeapon);
    this.world.component(BoomerangWeapon);
    this.world.component(DefaultWeapon);
    this.world.component(Bullet);
    this.world.component(Rocket);
    this.world.component(Boomerang);
    this.world.component(ShootingCooldown);
  }
}
