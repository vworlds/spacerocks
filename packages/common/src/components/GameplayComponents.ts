export type OwnerType = 'player' | 'alien';
export type PlayerId = 0 | 1;

export enum PickupKind {
  Shield = 'shield',
  Laser = 'laser',
  Aura = 'aura',
  Rocket = 'rocket',
  Boomerang = 'boomerang',
  Health = 'health',
}

export enum RandomClockKind {
  Alien = 'alien',
  ShieldPickup = 'shieldPickup',
  LaserPickup = 'laserPickup',
  AuraPickup = 'auraPickup',
  RocketPickup = 'rocketPickup',
  BoomerangPickup = 'boomerangPickup',
  HealthPickup = 'healthPickup',
}

export class Velocity {
  vx = 0;
  vy = 0;
}

export class AngularVelocity {
  omega = 0;
}

export class Friction {
  value = 0.98;
}

export class Thrust {
  force = 0;
  active = false;
}

export class Collider {
  radius = 10;
  category = 0;
  mask = 0;
}

export class Health {
  hp = 100;
  maxHp = 100;
  healthBarTimer = 0;
}

export class Shield {
  shieldTime = 0;
}

export class LaserWeapon {
  shots = 0;
  firing = false;
  timer = 0;
}

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

export class Boomerang {
  ownerId: number | null = null;
  armed = false;
}

export class Pickup {
  kind: PickupKind = PickupKind.Shield;
}

export class HealthPickup {
  amount = 0;
}

export class Player {
  playerId: PlayerId = 0;
}

export class ShipInput {
  thrustKey = '';
  rotateLeftKey = '';
  rotateRightKey = '';
  shootKey = '';
  shootCooldown = 0;
}

export class Bullet {
  ownerType: OwnerType = 'player';
}

export class Rocket {
  straightTimer = 0;
}

export class Asteroid {
  level: 1 | 2 | 3 = 3;
  color = '#aaa';
}

export class Alien {
  shootCooldown = 60;
}

export class Decay {
  life = 1;
  decay = 0.02;
}

export class Wraps {}

export class RandomClock {
  private _minWait = 0;
  private _maxWait = 0;
  kind: RandomClockKind = RandomClockKind.Alien;
  nextTick = 0;

  get minWait(): number {
    return this._minWait;
  }
  set minWait(v: number) {
    this._minWait = v;
    this.schedule();
  }

  get maxWait(): number {
    return this._maxWait;
  }
  set maxWait(v: number) {
    this._maxWait = v;
    this.schedule();
  }

  schedule(): void {
    if (this._minWait > 0 && this._maxWait > 0) {
      const now = Date.now();
      this.nextTick =
        now + this._minWait + Math.random() * (this._maxWait - this._minWait);
    }
  }
}
