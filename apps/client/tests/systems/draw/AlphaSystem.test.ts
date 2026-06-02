import { describe, it, expect, beforeEach } from 'vitest';
import { Drawable } from '@spacerocks/common';
import { Alpha } from '@src/components';
import { installAlphaDrawSystem } from '@src/systems/draw/AlphaSystem';
import { createTestWorld, type TestWorld } from '../../helpers/world';

let testWorld: TestWorld;

beforeEach(() => {
  testWorld = createTestWorld([Drawable, Alpha]);
  installAlphaDrawSystem(testWorld.world, testWorld.renderPhase);
  testWorld.world.start();
});

function tick() {
  testWorld.tickPhase(testWorld.renderPhase);
}

describe('AlphaDraw', () => {
  it('adds alpha and restore statements when Drawable + Alpha appear', () => {
    const e = testWorld.world.entity().add(Drawable).set(Alpha, { value: 0.5 });
    tick();
    const stmts = e.get(Drawable)!._statements;
    expect(stmts.map((s) => s.key)).toContain(Alpha);
    expect(stmts.length).toBeGreaterThanOrEqual(2);
  });

  it('alpha statement sets globalAlpha', () => {
    const e = testWorld.world.entity().add(Drawable).set(Alpha, { value: 0.7 });
    tick();
    const stmt = e.get(Drawable)!._statements.find((s) => s.key === Alpha)!;
    const ctx = { globalAlpha: 1 } as unknown as CanvasRenderingContext2D;
    stmt.fn(ctx);
    expect(ctx.globalAlpha).toBe(0.7);
  });

  it('restore statement returns globalAlpha to the value captured by alpha', () => {
    const e = testWorld.world.entity().add(Drawable).set(Alpha, { value: 0.3 });
    tick();
    const stmts = e.get(Drawable)!._statements;
    const sorted = [...stmts].sort((a, b) => b.priority - a.priority);
    const alphaStmt = stmts.find((s) => s.key === Alpha)!;
    const restore = sorted[sorted.length - 1]!;
    const ctx = { globalAlpha: 0.8 } as unknown as CanvasRenderingContext2D;
    alphaStmt.fn(ctx);
    expect(ctx.globalAlpha).toBe(0.3);
    restore.fn(ctx);
    expect(ctx.globalAlpha).toBe(0.8);
  });

  it('removes statements when Alpha is removed', () => {
    const e = testWorld.world.entity().add(Drawable).set(Alpha, { value: 0.5 });
    tick();
    e.remove(Alpha);
    tick();
    const stmts = e.get(Drawable)!._statements;
    expect(stmts.map((s) => s.key)).not.toContain(Alpha);
  });
});
