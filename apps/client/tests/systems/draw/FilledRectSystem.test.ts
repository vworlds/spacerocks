import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Drawable, FilledRect } from '@spacerocks/common';
import { installFilledRectDrawSystem } from '@src/systems/draw/FilledRectSystem';
import { createTestWorld, type TestWorld } from '../../helpers/world';

let testWorld: TestWorld;

beforeEach(() => {
  testWorld = createTestWorld([Drawable, FilledRect]);
  installFilledRectDrawSystem(testWorld.world, testWorld.renderPhase);
  testWorld.world.start();
});

function tick() {
  testWorld.tickPhase(testWorld.renderPhase);
}

describe('FilledRectDraw', () => {
  it('adds FilledRect draw statement when Drawable + FilledRect appear', () => {
    const e = testWorld.world
      .entity()
      .add(Drawable)
      .set(FilledRect, { width: 4, height: 4 });
    tick();
    expect(e.get(Drawable)!._statements.map((s) => s.key)).toContain(
      FilledRect,
    );
  });

  it('statement calls fillRect centered at origin', () => {
    const e = testWorld.world
      .entity()
      .add(Drawable)
      .set(FilledRect, { width: 10, height: 6 });
    tick();
    const stmt = e
      .get(Drawable)!
      ._statements.find((s) => s.key === FilledRect)!;
    const ctx = { fillRect: vi.fn() } as unknown as CanvasRenderingContext2D;
    stmt.fn(ctx);
    expect(ctx.fillRect).toHaveBeenCalledWith(-5, -3, 10, 6);
  });

  it('removes statement when FilledRect is removed', () => {
    const e = testWorld.world
      .entity()
      .add(Drawable)
      .set(FilledRect, { width: 4, height: 4 });
    tick();
    e.remove(FilledRect);
    tick();
    expect(e.get(Drawable)!._statements.map((s) => s.key)).not.toContain(
      FilledRect,
    );
  });
});
