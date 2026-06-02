import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { world, updatePhase, keys } from '@src/world';
import '@src/systems/Shooting';
import {
  Position,
  Rotation,
  ShipInput,
  DefaultWeapon,
  AuraWeapon,
  LaserWeapon,
  RocketWeapon,
  BoomerangWeapon,
  Bullet,
  Rocket,
  Boomerang,
} from '@src/components';
import { ENTITY_CONFIG } from '@src/constants';

beforeAll(() => world.start());
afterEach(() => {
  world.clearAllEntities();
  for (const k of Object.keys(keys.state)) keys.state[k] = false;
});

function tick() {
  world.beginFrame(16);
  world.runPhase(updatePhase, Date.now(), 16);
  world.endFrame();
}

function count<T>(C: new (...args: never[]) => T): number {
  let n = 0;
  world.filter([C as never]).forEach(() => n++);
  return n;
}

const SHOOT_KEY = 'Space';

function makeShip() {
  return world
    .entity()
    .set(Position, { x: 400, y: 300 })
    .set(Rotation, { angle: 0 })
    .set(ShipInput, {
      thrustKey: 'KeyW',
      rotateLeftKey: 'KeyA',
      rotateRightKey: 'KeyD',
      shootKey: SHOOT_KEY,
      shootCooldown: 0,
    });
}

describe('Shooting – DefaultWeapon', () => {
  it('fires a bullet when shoot key is pressed with DefaultWeapon', () => {
    makeShip().add(DefaultWeapon);
    keys.state[SHOOT_KEY] = true;
    const before = count(Bullet);
    tick();
    expect(count(Bullet)).toBe(before + 1);
  });

  it('does not fire when shoot key is not pressed', () => {
    makeShip().add(DefaultWeapon);
    const before = count(Bullet);
    tick();
    expect(count(Bullet)).toBe(before);
  });

  it('does not fire when shootCooldown is positive', () => {
    const e = makeShip().add(DefaultWeapon);
    e.set(ShipInput, {
      thrustKey: 'KeyW',
      rotateLeftKey: 'KeyA',
      rotateRightKey: 'KeyD',
      shootKey: SHOOT_KEY,
      shootCooldown: 5,
    });
    keys.state[SHOOT_KEY] = true;
    const before = count(Bullet);
    tick();
    expect(count(Bullet)).toBe(before);
  });

  it('sets shootCooldown after firing', () => {
    const e = makeShip().add(DefaultWeapon);
    keys.state[SHOOT_KEY] = true;
    tick();
    expect(e.get(ShipInput)!.shootCooldown).toBe(
      ENTITY_CONFIG.SHIP.SHOOT_COOLDOWN,
    );
  });
});

describe('Shooting – AuraWeapon', () => {
  it('fires 8 bullets in all directions', () => {
    makeShip().set(AuraWeapon, { shots: 3 });
    keys.state[SHOOT_KEY] = true;
    const before = count(Bullet);
    tick();
    expect(count(Bullet)).toBe(before + 8);
  });

  it('decrements shots', () => {
    const e = makeShip().set(AuraWeapon, { shots: 3 });
    keys.state[SHOOT_KEY] = true;
    tick();
    expect(e.get(AuraWeapon)!.shots).toBe(2);
  });

  it('switches to DefaultWeapon when shots reach 0', () => {
    const e = makeShip().set(AuraWeapon, { shots: 1 });
    keys.state[SHOOT_KEY] = true;
    tick();
    expect(e.get(AuraWeapon)).toBeUndefined();
    expect(e.get(DefaultWeapon)).toBeDefined();
  });
});

describe('Shooting – LaserWeapon', () => {
  it('sets laser to firing when shoot key pressed', () => {
    const e = makeShip().set(LaserWeapon, {
      shots: 5,
      firing: false,
      timer: 0,
    });
    keys.state[SHOOT_KEY] = true;
    tick();
    expect(e.get(LaserWeapon)!.firing).toBe(true);
  });

  it('sets laser timer', () => {
    const e = makeShip().set(LaserWeapon, {
      shots: 5,
      firing: false,
      timer: 0,
    });
    keys.state[SHOOT_KEY] = true;
    tick();
    expect(e.get(LaserWeapon)!.timer).toBe(ENTITY_CONFIG.SHIP.LASER_TIMER);
  });

  it('decrements shots on fire', () => {
    const e = makeShip().set(LaserWeapon, {
      shots: 5,
      firing: false,
      timer: 0,
    });
    keys.state[SHOOT_KEY] = true;
    tick();
    expect(e.get(LaserWeapon)!.shots).toBe(4);
  });
});

describe('Shooting – RocketWeapon', () => {
  it('creates a rocket when shoot key pressed', () => {
    makeShip().set(RocketWeapon, { shots: 5 });
    keys.state[SHOOT_KEY] = true;
    const before = count(Rocket);
    tick();
    expect(count(Rocket)).toBe(before + 1);
  });

  it('decrements shots', () => {
    const e = makeShip().set(RocketWeapon, { shots: 3 });
    keys.state[SHOOT_KEY] = true;
    tick();
    expect(e.get(RocketWeapon)!.shots).toBe(2);
  });

  it('switches to DefaultWeapon when shots reach 0', () => {
    const e = makeShip().set(RocketWeapon, { shots: 1 });
    keys.state[SHOOT_KEY] = true;
    tick();
    expect(e.get(RocketWeapon)).toBeUndefined();
    expect(e.get(DefaultWeapon)).toBeDefined();
  });
});

describe('Shooting – BoomerangWeapon', () => {
  it('creates a boomerang when shoot key pressed', () => {
    makeShip().set(BoomerangWeapon, { shots: 3, inFlight: 0 });
    keys.state[SHOOT_KEY] = true;
    const before = count(Boomerang);
    tick();
    expect(count(Boomerang)).toBe(before + 1);
  });

  it('decrements shots', () => {
    const e = makeShip().set(BoomerangWeapon, {
      shots: 3,
      inFlight: 0,
    });
    keys.state[SHOOT_KEY] = true;
    tick();
    expect(e.get(BoomerangWeapon)!.shots).toBe(2);
  });
});
