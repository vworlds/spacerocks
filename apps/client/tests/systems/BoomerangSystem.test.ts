import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { world, updatePhase } from '@src/world';
import '@src/systems/BoomerangSystem';
import {
  Position,
  Velocity,
  Boomerang,
  BoomerangWeapon,
  DefaultWeapon,
} from '@src/components';
import { ENTITY_CONFIG } from '@src/constants';

beforeAll(() => world.start());
afterEach(() => world.clearAllEntities());

function tick() {
  world.beginFrame(16);
  world.runPhase(updatePhase, Date.now(), 16);
  world.endFrame();
}

describe('BoomerangSystem', () => {
  it('pulls boomerang velocity toward owner position', () => {
    const owner = world.entity().set(Position, { x: 0, y: 0 });
    const boom = world
      .entity()
      .set(Position, { x: 100, y: 0 })
      .set(Velocity, { vx: 0, vy: 0 })
      .set(Boomerang, { ownerId: owner.eid, armed: true });
    tick();
    const vel = boom.get(Velocity)!;
    // Owner is to the left, so vx should be negative (pulled toward owner)
    expect(vel.vx).toBeLessThan(0);
  });

  it('pulls toward owner in y direction', () => {
    const owner = world.entity().set(Position, { x: 0, y: 0 });
    const boom = world
      .entity()
      .set(Position, { x: 0, y: 100 })
      .set(Velocity, { vx: 0, vy: 0 })
      .set(Boomerang, { ownerId: owner.eid, armed: true });
    tick();
    const vel = boom.get(Velocity)!;
    expect(vel.vy).toBeLessThan(0);
  });

  it('caps speed to MAX_SPEED', () => {
    const owner = world.entity().set(Position, { x: 0, y: 0 });
    const ms = ENTITY_CONFIG.BOOMERANG.MAX_SPEED;
    const boom = world
      .entity()
      .set(Position, { x: 50, y: 0 })
      .set(Velocity, { vx: -ms * 2, vy: 0 })
      .set(Boomerang, { ownerId: owner.eid, armed: true });
    tick();
    const vel = boom.get(Velocity)!;
    const speed = Math.hypot(vel.vx, vel.vy);
    expect(speed).toBeLessThanOrEqual(ms + 0.001);
  });

  it('arms boomerang when it travels beyond ARM_DISTANCE', () => {
    const owner = world.entity().set(Position, { x: 0, y: 0 });
    const boom = world
      .entity()
      .set(Position, { x: ENTITY_CONFIG.BOOMERANG.ARM_DISTANCE + 10, y: 0 })
      .set(Velocity, { vx: 0, vy: 0 })
      .set(Boomerang, { ownerId: owner.eid, armed: false });
    tick();
    expect(boom.get(Boomerang)!.armed).toBe(true);
  });

  it('does not arm boomerang when still close to owner', () => {
    const owner = world.entity().set(Position, { x: 0, y: 0 });
    const boom = world
      .entity()
      .set(Position, { x: 5, y: 0 })
      .set(Velocity, { vx: 0, vy: 0 })
      .set(Boomerang, { ownerId: owner.eid, armed: false });
    tick();
    expect(boom.get(Boomerang)!.armed).toBe(false);
  });

  it('removes BoomerangWeapon and adds DefaultWeapon when all shots are gone and boomerang exits', () => {
    const owner = world
      .entity()
      .set(BoomerangWeapon, { shots: 0, inFlight: 1 });
    const boom = world
      .entity()
      .set(Position, { x: 50, y: 0 })
      .set(Velocity, { vx: 0, vy: 0 })
      .set(Boomerang, { ownerId: owner.eid, armed: false });
    // Run a frame first so the entity is tracked in the system query (enter fires).
    // Then destroy and run another frame so the exit fires and processes the owner swap.
    tick();
    boom.destroy();
    tick();
    expect(owner.get(BoomerangWeapon)).toBeUndefined();
    expect(owner.get(DefaultWeapon)).toBeDefined();
  });

  it('removes boomerang from inFlight set on exit', () => {
    const owner = world
      .entity()
      .set(BoomerangWeapon, { shots: 1, inFlight: 1 });
    const boom = world
      .entity()
      .set(Position, { x: 50, y: 0 })
      .set(Velocity, { vx: 0, vy: 0 })
      .set(Boomerang, { ownerId: owner.eid, armed: false });
    const bw = owner.get(BoomerangWeapon)!;
    tick();
    boom.destroy();
    tick();
    expect(bw.inFlight).toBe(0);
  });

  it('does nothing when owner has no Position', () => {
    const owner = world.entity();
    const boom = world
      .entity()
      .set(Position, { x: 100, y: 0 })
      .set(Velocity, { vx: 0, vy: 0 })
      .set(Boomerang, { ownerId: owner.eid, armed: false });
    // Should not throw
    tick();
    expect(boom.get(Velocity)!.vx).toBe(0);
  });
});
