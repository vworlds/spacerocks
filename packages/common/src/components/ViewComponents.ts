import { type as wireType } from '@vworlds/vecs-wire';

export class PlayerShip {
  @wireType('u32')
  playerIndex = 0;

  @wireType('string')
  color = '#fff';
}

export class AsteroidView {
  @wireType('u32')
  level = 1;

  @wireType('string')
  color = '#888';

  @wireType('f64')
  radius = 20;
}

export class ProjectileView {
  @wireType('u32')
  kind = 0;

  @wireType('u32')
  team = 0;
}

export class PickupView {
  @wireType('u32')
  kind = 0;

  @wireType('f64')
  amount = 0;
}

export class HealthView {
  @wireType('f64')
  hp = 0;

  @wireType('f64')
  maxHp = 0;

  @wireType('f64')
  barTimer = 0;
}

export class ShieldView {
  @wireType('f64')
  remainingTime = 0;
}

export class WeaponView {
  @wireType('u32')
  activeWeapon = 0;

  @wireType('u32')
  ammo = 0;
}

export class GameStateView {
  @wireType('u32')
  state = 0;

  @wireType('u32')
  wave = 0;

  @wireType('u32')
  score = 0;

  @wireType('string')
  status = '';
}

export class ExplosionView {
  @wireType('string')
  color = '#fff';

  @wireType('f64')
  size = 0;

  @wireType('u32')
  seed = 0;

  @wireType('f64')
  duration = 0;
}
