import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Drawable, StrokeStyle } from '@spacerocks/common';
import { installStrokeStyleDrawSystem } from '@src/systems/draw/StrokeStyleSystem';
import { createTestWorld, type TestWorld } from '../../helpers/world';

let testWorld: TestWorld;

beforeEach(() => {
  testWorld = createTestWorld([Drawable, StrokeStyle]);
  installStrokeStyleDrawSystem(testWorld.world);
});

function tick() {
  testWorld.tickPhase(testWorld.renderPhase);
}

describe('StrokeStyleDraw', () => {
  it('adds StrokeStyle and stroke-exec statements when Drawable + StrokeStyle appear', () => {
    const e = testWorld.world
      .entity()
      .add(Drawable)
      .set(StrokeStyle, { style: '#0f0', lineWidth: 2 });
    tick();
    const stmts = e.get(Drawable)!._statements;
    expect(stmts.length).toBeGreaterThanOrEqual(2);
    expect(stmts.some((s) => s.key === StrokeStyle)).toBe(true);
  });

  it('StrokeStyle statement sets strokeStyle and lineWidth', () => {
    const e = testWorld.world
      .entity()
      .add(Drawable)
      .set(StrokeStyle, { style: '#ff0', lineWidth: 3 });
    tick();
    const stmt = e
      .get(Drawable)!
      ._statements.find((s) => s.key === StrokeStyle)!;
    const ctx = {
      strokeStyle: '',
      lineWidth: 1,
    } as unknown as CanvasRenderingContext2D;
    stmt.fn(ctx);
    expect(ctx.strokeStyle).toBe('#ff0');
    expect(ctx.lineWidth).toBe(3);
  });

  it('stroke-exec statement calls stroke()', () => {
    const e = testWorld.world
      .entity()
      .add(Drawable)
      .set(StrokeStyle, { style: '#fff', lineWidth: 1 });
    tick();
    const execStmt = e
      .get(Drawable)!
      ._statements.find((s) => s.key !== StrokeStyle)!;
    const ctx = { stroke: vi.fn() } as unknown as CanvasRenderingContext2D;
    execStmt.fn(ctx);
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it('removes statements when StrokeStyle is removed', () => {
    const e = testWorld.world
      .entity()
      .add(Drawable)
      .set(StrokeStyle, { style: '#fff', lineWidth: 1 });
    tick();
    e.remove(StrokeStyle);
    tick();
    expect(
      e.get(Drawable)!._statements.some((s) => s.key === StrokeStyle),
    ).toBe(false);
  });
});
