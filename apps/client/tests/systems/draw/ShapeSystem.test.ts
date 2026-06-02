import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Drawable, Shape } from '@spacerocks/common';
import { installShapeDrawSystem } from '@src/systems/draw/ShapeSystem';
import { createTestWorld, type TestWorld } from '../../helpers/world';

let testWorld: TestWorld;

beforeEach(() => {
  testWorld = createTestWorld([Drawable, Shape]);
  installShapeDrawSystem(testWorld.world, testWorld.renderPhase);
  testWorld.world.start();
});

function tick() {
  testWorld.tickPhase(testWorld.renderPhase);
}

describe('ShapeDraw', () => {
  it('adds Shape draw statement when Drawable + Shape appear', () => {
    const e = testWorld.world
      .entity()
      .add(Drawable)
      .set(Shape, { points: [{ x: 0, y: 0 }] });
    tick();
    expect(e.get(Drawable)!._statements.map((s) => s.key)).toContain(Shape);
  });

  it('draws polygon using moveTo and lineTo', () => {
    const points = [
      { x: 0, y: -10 },
      { x: 10, y: 5 },
      { x: -10, y: 5 },
    ];
    const e = testWorld.world.entity().add(Drawable).set(Shape, { points });
    tick();
    const stmt = e.get(Drawable)!._statements.find((s) => s.key === Shape)!;
    const ctx = {
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    stmt.fn(ctx);
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.moveTo).toHaveBeenCalledWith(0, -10);
    expect(ctx.lineTo).toHaveBeenCalledWith(10, 5);
    expect(ctx.lineTo).toHaveBeenCalledWith(-10, 5);
    expect(ctx.closePath).toHaveBeenCalled();
  });

  it('handles empty points array without error', () => {
    const e = testWorld.world.entity().add(Drawable).set(Shape, { points: [] });
    tick();
    const stmt = e.get(Drawable)!._statements.find((s) => s.key === Shape)!;
    const ctx = {
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    expect(() => stmt.fn(ctx)).not.toThrow();
    expect(ctx.moveTo).not.toHaveBeenCalled();
  });

  it('removes statement when Shape is removed', () => {
    const e = testWorld.world.entity().add(Drawable).set(Shape, { points: [] });
    tick();
    e.remove(Shape);
    tick();
    expect(e.get(Drawable)!._statements.map((s) => s.key)).not.toContain(Shape);
  });
});
