import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Drawable, HealthView } from '@spacerocks/common';
import { installHealthDrawSystem } from '@src/systems/draw/HealthDraw';
import { createTestWorld, type TestWorld } from '../../helpers/world';

let testWorld: TestWorld;

beforeEach(() => {
  testWorld = createTestWorld([Drawable, HealthView]);
  installHealthDrawSystem(testWorld.world);
});

function tick() {
  testWorld.tickPhase(testWorld.renderPhase);
}

function statementFor(entity: ReturnType<TestWorld['world']['entity']>) {
  return entity.get(Drawable)!._statements.find((s) => s.key === HealthView)!;
}

function ctxMock() {
  return {
    strokeRect: vi.fn(),
    fillRect: vi.fn(),
    strokeStyle: '',
    lineWidth: 1,
    fillStyle: '',
  } as unknown as CanvasRenderingContext2D;
}

describe('HealthDraw', () => {
  it('adds HealthView draw statement when Drawable + HealthView appear', () => {
    const e = testWorld.world
      .entity()
      .add(Drawable)
      .set(HealthView, { hp: 100, maxHp: 100, barTimer: 0 });
    tick();
    expect(e.get(Drawable)!._statements.map((s) => s.key)).toContain(
      HealthView,
    );
  });

  it('does not draw health bar when barTimer is 0', () => {
    const e = testWorld.world
      .entity()
      .add(Drawable)
      .set(HealthView, { hp: 80, maxHp: 100, barTimer: 0 });
    tick();
    const ctx = ctxMock();
    statementFor(e).fn(ctx);
    expect(ctx.strokeRect).not.toHaveBeenCalled();
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });

  it('draws health bar when barTimer > 0', () => {
    const e = testWorld.world
      .entity()
      .add(Drawable)
      .set(HealthView, { hp: 80, maxHp: 100, barTimer: 30 });
    tick();
    const ctx = ctxMock();
    statementFor(e).fn(ctx);
    expect(ctx.strokeRect).toHaveBeenCalled();
    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it('uses green fill for hp > 66', () => {
    const e = testWorld.world
      .entity()
      .add(Drawable)
      .set(HealthView, { hp: 100, maxHp: 100, barTimer: 10 });
    tick();
    const ctx = ctxMock();
    statementFor(e).fn(ctx);
    expect(ctx.fillStyle).toBe('#0f0');
  });

  it('uses yellow fill for hp between 33 and 66', () => {
    const e = testWorld.world
      .entity()
      .add(Drawable)
      .set(HealthView, { hp: 50, maxHp: 100, barTimer: 10 });
    tick();
    const ctx = ctxMock();
    statementFor(e).fn(ctx);
    expect(ctx.fillStyle).toBe('#ff0');
  });

  it('uses red fill for hp <= 33', () => {
    const e = testWorld.world
      .entity()
      .add(Drawable)
      .set(HealthView, { hp: 20, maxHp: 100, barTimer: 10 });
    tick();
    const ctx = ctxMock();
    statementFor(e).fn(ctx);
    expect(ctx.fillStyle).toBe('#f00');
  });

  it('removes statement when HealthView is removed', () => {
    const e = testWorld.world
      .entity()
      .add(Drawable)
      .set(HealthView, { hp: 20, maxHp: 100, barTimer: 10 });
    tick();
    e.remove(HealthView);
    tick();
    expect(e.get(Drawable)!._statements.map((s) => s.key)).not.toContain(
      HealthView,
    );
  });
});
