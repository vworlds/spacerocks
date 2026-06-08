import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Drawable, ENTITY_CONFIG, ShieldView } from '@spacerocks/common';
import { installShieldDrawSystem } from '@src/systems/draw/ShieldDraw';
import { createTestWorld, type TestWorld } from '../../helpers/world';

let testWorld: TestWorld;

beforeEach(() => {
  testWorld = createTestWorld([Drawable, ShieldView]);
  installShieldDrawSystem(testWorld.world);
});

function tick() {
  testWorld.tickPhase(testWorld.renderPhase);
}

function ctxMock() {
  return {
    beginPath: vi.fn(),
    arc: vi.fn(),
    stroke: vi.fn(),
    strokeStyle: '',
    lineWidth: 1,
  } as unknown as CanvasRenderingContext2D;
}

describe('ShieldDraw', () => {
  it('adds ShieldView draw statement when Drawable + ShieldView appear', () => {
    const e = testWorld.world
      .entity()
      .add(Drawable)
      .set(ShieldView, { remainingTime: 2400 });
    tick();
    expect(e.get(Drawable)!._statements.map((s) => s.key)).toContain(
      ShieldView,
    );
  });

  it('draws arc for shield circle when active', () => {
    const e = testWorld.world
      .entity()
      .add(Drawable)
      .set(ShieldView, { remainingTime: 2400 });
    tick();
    const stmt = e
      .get(Drawable)!
      ._statements.find((s) => s.key === ShieldView)!;
    const ctx = ctxMock();
    stmt.fn(ctx);
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.arc).toHaveBeenCalledWith(
      0,
      0,
      ENTITY_CONFIG.SHIP.RADIUS + 8,
      0,
      Math.PI * 2,
    );
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.lineWidth).toBe(3);
  });

  it('does nothing when remainingTime is 0', () => {
    const e = testWorld.world
      .entity()
      .add(Drawable)
      .set(ShieldView, { remainingTime: 0 });
    tick();
    const stmt = e
      .get(Drawable)!
      ._statements.find((s) => s.key === ShieldView)!;
    const ctx = ctxMock();
    stmt.fn(ctx);
    expect(ctx.beginPath).not.toHaveBeenCalled();
    expect(ctx.stroke).not.toHaveBeenCalled();
  });

  it('uses green color at full shield', () => {
    const full = ENTITY_CONFIG.SHIP.SHIELD_DURATION;
    const e = testWorld.world
      .entity()
      .add(Drawable)
      .set(ShieldView, { remainingTime: full });
    tick();
    const stmt = e
      .get(Drawable)!
      ._statements.find((s) => s.key === ShieldView)!;
    const ctx = ctxMock();
    stmt.fn(ctx);
    expect(ctx.strokeStyle).toBe('rgb(0,255,0)');
  });

  it('uses red color at near-zero shield', () => {
    const e = testWorld.world
      .entity()
      .add(Drawable)
      .set(ShieldView, { remainingTime: 1 });
    tick();
    const stmt = e
      .get(Drawable)!
      ._statements.find((s) => s.key === ShieldView)!;
    const ctx = ctxMock();
    stmt.fn(ctx);
    expect(ctx.strokeStyle).toBe('rgb(255,0,0)');
  });

  it('removes statement when ShieldView is removed', () => {
    const e = testWorld.world
      .entity()
      .add(Drawable)
      .set(ShieldView, { remainingTime: 2400 });
    tick();
    e.remove(ShieldView);
    tick();
    expect(e.get(Drawable)!._statements.map((s) => s.key)).not.toContain(
      ShieldView,
    );
  });
});
