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
  vx = 0; // world units/frame
  vy = 0; // world units/frame
}

export class AngularVelocity {
  omega = 0; // radians/frame
}

export class Friction {
  value = 0.98; // multiplier/frame
}

export class Thrust {
  force = 0; // world units/frame^2
  active = false;
}

export class Collider {
  radius = 10; // world units
  category = 0; // bitmask
  mask = 0; // bitmask
}

export class Health {
  hp = 100; // hp
  maxHp = 100; // hp
  healthBarTimer = 0; // frames
}

export class Shield {
  shieldTime = 0; // frames
}

export class LaserWeapon {
  shots = 0; // shots
  firing = false;
  timer = 0; // frames
}

export class AuraWeapon {
  shots = 0; // shots
}

export class RocketWeapon {
  shots = 0; // shots
}

export class BoomerangWeapon {
  shots = 0; // shots
  inFlight = 0; // entities
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
  amount = 0; // ratio
}

export class Player {
  playerId: PlayerId = 0; // player id
}

export class ShipInput {
  thrustKey = '';
  rotateLeftKey = '';
  rotateRightKey = '';
  shootKey = '';
  shootCooldown = 0; // frames
}

export class Bullet {
  ownerType: OwnerType = 'player';
}

export class Rocket {
  straightTimer = 0; // frames
}

export class Asteroid {
  level: 1 | 2 | 3 = 3; // tier
  color = '#aaa';
}

export class Alien {
  shootCooldown = 60; // frames
}

export class Decay {
  life = 1; // normalized ratio
  decay = 0.02; // normalized ratio/frame
}

export class Wraps {}

export class RandomClock {
  private _minWait = 0; // ms
  private _maxWait = 0; // ms
  kind: RandomClockKind = RandomClockKind.Alien;
  nextTick = 0; // unix ms

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
