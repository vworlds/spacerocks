import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Drawable, FillStyle } from '@spacerocks/common';
import { installFillStyleDrawSystem } from '@src/systems/draw/FillStyleSystem';
import { createTestWorld, type TestWorld } from '../../helpers/world';

let testWorld: TestWorld;

beforeEach(() => {
  testWorld = createTestWorld([Drawable, FillStyle]);
  installFillStyleDrawSystem(testWorld.world, testWorld.renderPhase);
  testWorld.world.start();
});

function tick() {
  testWorld.tickPhase(testWorld.renderPhase);
}

describe('FillStyleDraw', () => {
  it('adds FillStyle and fill-exec statements when Drawable + FillStyle appear', () => {
    const e = testWorld.world
      .entity()
      .add(Drawable)
      .set(FillStyle, { style: '#f00' });
    tick();
    const stmts = e.get(Drawable)!._statements;
    expect(stmts.length).toBeGreaterThanOrEqual(2);
    expect(stmts.some((s) => s.key === FillStyle)).toBe(true);
  });

  it('FillStyle statement sets fillStyle', () => {
    const e = testWorld.world
      .entity()
      .add(Drawable)
      .set(FillStyle, { style: '#abc' });
    tick();
    const stmt = e.get(Drawable)!._statements.find((s) => s.key === FillStyle)!;
    const ctx = { fillStyle: '' } as unknown as CanvasRenderingContext2D;
    stmt.fn(ctx);
    expect(ctx.fillStyle).toBe('#abc');
  });

  it('fill-exec statement calls fill()', () => {
    const e = testWorld.world
      .entity()
      .add(Drawable)
      .set(FillStyle, { style: '#fff' });
    tick();
    const stmts = e.get(Drawable)!._statements;
    const fillExec = stmts.find((s) => s.key !== FillStyle)!;
    const ctx = { fill: vi.fn() } as unknown as CanvasRenderingContext2D;
    fillExec.fn(ctx);
    expect(ctx.fill).toHaveBeenCalled();
  });

  it('removes statements when FillStyle is removed', () => {
    const e = testWorld.world
      .entity()
      .add(Drawable)
      .set(FillStyle, { style: '#fff' });
    tick();
    e.remove(FillStyle);
    tick();
    expect(e.get(Drawable)!._statements.some((s) => s.key === FillStyle)).toBe(
      false,
    );
  });
});
