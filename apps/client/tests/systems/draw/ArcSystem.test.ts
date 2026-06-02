import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Arc, Drawable } from '@spacerocks/common';
import { installArcDrawSystem } from '@src/systems/draw/ArcSystem';
import { createTestWorld, type TestWorld } from '../../helpers/world';

let testWorld: TestWorld;

beforeEach(() => {
  testWorld = createTestWorld([Drawable, Arc]);
  installArcDrawSystem(testWorld.world, testWorld.renderPhase);
  testWorld.world.start();
});

function tick() {
  testWorld.tickPhase(testWorld.renderPhase);
}

describe('ArcDraw', () => {
  it('adds an Arc draw statement when Drawable + Arc appear', () => {
    const e = testWorld.world
      .entity()
      .add(Drawable)
      .set(Arc, { radius: 10, startAngle: 0, endAngle: Math.PI * 2 });
    tick();
    expect(e.get(Drawable)!._statements.map((s) => s.key)).toContain(Arc);
  });

  it('arc statement calls beginPath and arc with the right values', () => {
    const e = testWorld.world
      .entity()
      .add(Drawable)
      .set(Arc, { radius: 15, startAngle: 0.5, endAngle: 2.5 });
    tick();
    const stmt = e.get(Drawable)!._statements.find((s) => s.key === Arc)!;
    const ctx = {
      beginPath: vi.fn(),
      arc: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    stmt.fn(ctx);
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.arc).toHaveBeenCalledWith(0, 0, 15, 0.5, 2.5);
  });

  it('removes arc statement when Arc is removed', () => {
    const e = testWorld.world
      .entity()
      .add(Drawable)
      .set(Arc, { radius: 10, startAngle: 0, endAngle: Math.PI * 2 });
    tick();
    e.remove(Arc);
    tick();
    expect(e.get(Drawable)!._statements.map((s) => s.key)).not.toContain(Arc);
  });
});
