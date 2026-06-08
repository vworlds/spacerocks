import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Drawable, WORLD_WIDTH, WeaponView } from '@spacerocks/common';
import { installLaserBeamDrawSystem } from '@src/systems/draw/LaserBeamDraw';
import { createTestWorld, type TestWorld } from '../../helpers/world';

const LASER = 1; // enum id

let testWorld: TestWorld;

beforeEach(() => {
  testWorld = createTestWorld([Drawable, WeaponView]);
  installLaserBeamDrawSystem(testWorld.world);
});

function tick() {
  testWorld.tickPhase(testWorld.renderPhase);
}

function ctxMock() {
  return {
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    strokeStyle: '',
    lineWidth: 1,
  } as unknown as CanvasRenderingContext2D;
}

describe('LaserBeamDraw', () => {
  it('adds WeaponView draw statement when Drawable + WeaponView appear', () => {
    const e = testWorld.world
      .entity()
      .add(Drawable)
      .set(WeaponView, { activeWeapon: LASER, ammo: 5, firing: 0 });
    tick();
    expect(e.get(Drawable)!._statements.map((s) => s.key)).toContain(
      WeaponView,
    );
  });

  it('does not draw when not firing', () => {
    const e = testWorld.world
      .entity()
      .add(Drawable)
      .set(WeaponView, { activeWeapon: LASER, ammo: 5, firing: 0 });
    tick();
    const stmt = e
      .get(Drawable)!
      ._statements.find((s) => s.key === WeaponView)!;
    const ctx = ctxMock();
    stmt.fn(ctx);
    expect(ctx.beginPath).not.toHaveBeenCalled();
    expect(ctx.stroke).not.toHaveBeenCalled();
  });

  it('does not draw when the active weapon is not the laser', () => {
    const e = testWorld.world
      .entity()
      .add(Drawable)
      .set(WeaponView, { activeWeapon: 0, ammo: 5, firing: 1 });
    tick();
    const stmt = e
      .get(Drawable)!
      ._statements.find((s) => s.key === WeaponView)!;
    const ctx = ctxMock();
    stmt.fn(ctx);
    expect(ctx.beginPath).not.toHaveBeenCalled();
  });

  it('draws laser beam when firing', () => {
    const e = testWorld.world
      .entity()
      .add(Drawable)
      .set(WeaponView, { activeWeapon: LASER, ammo: 5, firing: 1 });
    tick();
    const stmt = e
      .get(Drawable)!
      ._statements.find((s) => s.key === WeaponView)!;
    const ctx = ctxMock();
    stmt.fn(ctx);
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.moveTo).toHaveBeenCalledWith(0, 0);
    expect(ctx.lineTo).toHaveBeenCalledWith(WORLD_WIDTH, 0);
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.strokeStyle).toBe('#ff0000');
    expect(ctx.lineWidth).toBe(4);
  });

  it('removes statement when WeaponView is removed', () => {
    const e = testWorld.world
      .entity()
      .add(Drawable)
      .set(WeaponView, { activeWeapon: LASER, ammo: 5, firing: 0 });
    tick();
    e.remove(WeaponView);
    tick();
    expect(e.get(Drawable)!._statements.map((s) => s.key)).not.toContain(
      WeaponView,
    );
  });
});
