import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Drawable } from '@spacerocks/common';
import { Label } from '@src/components';
import { installLabelDrawSystem } from '@src/systems/draw/LabelSystem';
import { createTestWorld, type TestWorld } from '../../helpers/world';

let testWorld: TestWorld;

beforeEach(() => {
  testWorld = createTestWorld([Drawable, Label]);
  installLabelDrawSystem(testWorld.world);
});

function tick() {
  testWorld.tickPhase(testWorld.renderPhase);
}

describe('LabelDraw', () => {
  it('adds Label draw statement when Drawable + Label appear', () => {
    const e = testWorld.world.entity().add(Drawable).set(Label, {
      text: 'Hi',
      font: 'bold 14px Arial',
      textAlign: 'center',
      textBaseline: 'middle',
      color: '#fff',
    });
    tick();
    expect(e.get(Drawable)!._statements.map((s) => s.key)).toContain(Label);
  });

  it('label statement sets ctx properties and calls fillText', () => {
    const e = testWorld.world.entity().add(Drawable).set(Label, {
      text: 'Score: 100',
      font: 'bold 16px sans-serif',
      textAlign: 'left',
      textBaseline: 'top',
      color: '#ff0',
    });
    tick();
    const stmt = e.get(Drawable)!._statements.find((s) => s.key === Label)!;
    const ctx = {
      fillStyle: '',
      font: '',
      textAlign: '' as CanvasTextAlign,
      textBaseline: '' as CanvasTextBaseline,
      fillText: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    stmt.fn(ctx);
    expect(ctx.fillStyle).toBe('#ff0');
    expect(ctx.font).toBe('bold 16px sans-serif');
    expect(ctx.textAlign).toBe('left');
    expect(ctx.textBaseline).toBe('top');
    expect(ctx.fillText).toHaveBeenCalledWith('Score: 100', 0, 0);
  });

  it('removes label statement when Label is removed', () => {
    const e = testWorld.world.entity().add(Drawable).set(Label, {
      text: 'test',
      font: '',
      textAlign: 'center',
      textBaseline: 'middle',
      color: '#fff',
    });
    tick();
    e.remove(Label);
    tick();
    expect(e.get(Drawable)!._statements.map((s) => s.key)).not.toContain(Label);
  });
});
