import { ChildOf, World } from '@vworlds/vecs';
import {
  Container,
  DrawIn,
  FillStyle,
  Offset,
  Rectangle,
  Size,
  StrokeStyle,
} from '@vworlds/vecs-phaser';
import { ProgressBar } from '@spacerocks/common';
import { describe, expect, it } from 'vitest';
import {
  ProgressBarModule,
  ProgressBarView,
} from '../../src/render/ProgressBarModule';

function createTestWorld(): World {
  const world = new World();
  for (const component of [
    Container,
    DrawIn,
    FillStyle,
    Offset,
    ProgressBar,
    Rectangle,
    Size,
    StrokeStyle,
  ]) {
    world.component(component);
  }
  world.module(ProgressBarModule);
  return world;
}

function progress(world: World): void {
  world.progress(16, 16);
}

describe('ProgressBarModule', () => {
  it('expands ProgressBar into an owned container border and fill', () => {
    const world = createTestWorld();
    const entity = world.entity().set(ProgressBar, { value: 75 });

    progress(world);

    const view = entity.get(ProgressBarView)!;
    expect(entity.has(Container)).toBe(true);
    expect(view.border.target(ChildOf)).toBe(entity);
    expect(view.border.target(DrawIn)).toBe(entity);
    expect(view.border.has(Rectangle)).toBe(true);
    expect(view.border.get(Size)).toEqual({ width: 0.3, height: 0.05 });
    expect(view.border.get(Offset)).toEqual({ x: 0, y: 0 });
    expect(view.border.get(StrokeStyle)).toEqual({
      color: 0x00ff00,
      alpha: 1,
      width: 1,
    });

    expect(view.fill.target(ChildOf)).toBe(entity);
    expect(view.fill.target(DrawIn)).toBe(entity);
    expect(view.fill.has(Rectangle)).toBe(true);
    expect(view.fill.get(Size)?.width).toBeCloseTo(0.225);
    expect(view.fill.get(Size)?.height).toBe(0.05);
    expect(view.fill.get(Offset)?.x).toBeCloseTo(-0.0375);
    expect(view.fill.get(Offset)?.y).toBe(0);
    expect(view.fill.get(FillStyle)).toEqual({ color: 0x00ff00, alpha: 1 });
  });

  it('preserves local view state when a network snapshot replaces ProgressBar', () => {
    const world = createTestWorld();
    const entity = world.entity().set(ProgressBar, { value: 75 });
    progress(world);
    const view = entity.get(ProgressBarView)!;

    const replacement = new ProgressBar();
    replacement.value = 25;
    entity.attach(replacement);
    progress(world);

    expect(entity.get(ProgressBarView)).toBe(view);
    expect(view.fill.get(Size)?.width).toBeCloseTo(0.075);
    expect(view.fill.get(Size)?.height).toBe(0.05);
    expect(view.fill.get(Offset)?.x).toBeCloseTo(-0.1125);
    expect(view.fill.get(Offset)?.y).toBe(0);
    expect(view.fill.get(FillStyle)).toEqual({ color: 0xff0000, alpha: 1 });
  });

  it('destroys local children when ProgressBar is removed or its entity dies', () => {
    const world = createTestWorld();
    const entity = world.entity().set(ProgressBar, { value: 50 });
    progress(world);
    const removedView = entity.get(ProgressBarView)!;

    world.defer(() => entity.remove(ProgressBar));

    expect(world.getEntity(removedView.border.eid)).toBeUndefined();
    expect(world.getEntity(removedView.fill.eid)).toBeUndefined();
    expect(entity.has(ProgressBarView)).toBe(false);
    expect(entity.has(Container)).toBe(false);

    entity.set(ProgressBar, { value: 50 });
    progress(world);
    const destroyedView = entity.get(ProgressBarView)!;
    entity.destroy();

    expect(world.getEntity(destroyedView.border.eid)).toBeUndefined();
    expect(world.getEntity(destroyedView.fill.eid)).toBeUndefined();
  });
});
