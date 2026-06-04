import { type as wireType } from '@vworlds/vecs-wire';

export class PlayerShip {
  @wireType('u32')
  playerIndex = 0; // player index

  @wireType('string')
  color = '#fff';
}

export class AsteroidView {
  @wireType('u32')
  level = 1; // tier

  @wireType('string')
  color = '#888';

  @wireType('f64')
  radius = 20; // world units
}

export class ProjectileView {
  @wireType('u32')
  kind = 0; // enum id

  @wireType('u32')
  team = 0; // team id
}

export class PickupView {
  @wireType('u32')
  kind = 0; // enum id

  @wireType('f64')
  amount = 0; // ratio
}

export class HealthView {
  @wireType('f64')
  hp = 0; // hp

  @wireType('f64')
  maxHp = 0; // hp

  @wireType('f64')
  barTimer = 0; // frames
}

export class ShieldView {
  @wireType('f64')
  remainingTime = 0; // frames
}

export class WeaponView {
  @wireType('u32')
  activeWeapon = 0; // enum id

  @wireType('u32')
  ammo = 0; // shots

  @wireType('u32')
  firing = 0; // boolean flag
}

export class GameStateView {
  @wireType('u32')
  state = 0; // enum id

  @wireType('u32')
  wave = 0; // wave number

  @wireType('u32')
  score = 0; // points

  @wireType('string')
  status = '';
}

export class ExplosionView {
  @wireType('string')
  color = '#fff';

  @wireType('f64')
  size = 0; // world units

  @wireType('u32')
  seed = 0; // rng seed

  @wireType('f64')
  duration = 0; // frames
}
