import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  Drawable,
  Position,
  Rotation,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from '@spacerocks/common';
import { installRenderSystem } from '@src/systems/Render';
import { createTestWorld, type TestWorld } from '../helpers/world';

function makeCanvas(width = 800, height = 600) {
  return { width, height } as HTMLCanvasElement;
}

function makeCtx() {
  return {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
  };
}

let testWorld: TestWorld;
let ctx: ReturnType<typeof makeCtx>;
let canvas: HTMLCanvasElement;

beforeEach(() => {
  testWorld = createTestWorld([Position, Rotation, Drawable]);
  ctx = makeCtx();
  canvas = makeCanvas();
  installRenderSystem(testWorld.world, {
    ctx: ctx as unknown as CanvasRenderingContext2D,
    canvas,
    stars: [],
  });
});

function tick() {
  testWorld.tickPhase(testWorld.renderPhase);
}

describe('Render', () => {
  it('fills the background black before drawing entities', () => {
    tick();
    expect(ctx.fillRect).toHaveBeenCalledWith(
      0,
      0,
      canvas.width,
      canvas.height,
    );
  });

  it('draws each star in the supplied star field', () => {
    canvas.width = 200;
    canvas.height = 200;
    const stars = [
      { x: 10, y: 20, size: 1, opacity: 0.5 },
      { x: 30, y: 40, size: 2, opacity: 0.8 },
    ];
    testWorld = createTestWorld([Position, Rotation, Drawable]);
    ctx = makeCtx();
    installRenderSystem(testWorld.world, {
      ctx: ctx as unknown as CanvasRenderingContext2D,
      canvas,
      stars,
    });
    tick();
    expect(ctx.arc).toHaveBeenCalledTimes(stars.length);
  });

  it('calls draw on each entity that has Position + Drawable', () => {
    const drawFn = vi.fn();
    testWorld.world
      .entity()
      .set(Position, { x: 100, y: 200 })
      .set(Drawable, {
        zIndex: 0,
        _statements: [{ key: 'test', priority: 50, fn: drawFn }],
        _sortedFns: undefined,
      });
    tick();
    expect(drawFn).toHaveBeenCalled();
  });

  it('translates and scales according to world->canvas mapping', () => {
    canvas.width = WORLD_WIDTH * 2;
    canvas.height = WORLD_HEIGHT * 2;
    testWorld.world
      .entity()
      .set(Position, { x: 100, y: 50 })
      .set(Drawable, { zIndex: 0, _statements: [], _sortedFns: [] });
    tick();
    expect(ctx.translate).toHaveBeenCalledWith(200, 100);
    expect(ctx.scale).toHaveBeenCalledWith(2, 2);
  });

  it('rotates when entity has Rotation', () => {
    testWorld.world
      .entity()
      .set(Position, { x: 0, y: 0 })
      .set(Rotation, { angle: Math.PI / 4 })
      .set(Drawable, { zIndex: 0, _statements: [], _sortedFns: [] });
    tick();
    expect(ctx.rotate).toHaveBeenCalledWith(Math.PI / 4);
  });

  it('draws Drawables in ascending zIndex order', () => {
    const order: number[] = [];
    testWorld.world
      .entity()
      .set(Position, { x: 0, y: 0 })
      .set(Drawable, {
        zIndex: 30,
        _statements: [{ key: 'hi', priority: 50, fn: () => order.push(30) }],
        _sortedFns: undefined,
      });
    testWorld.world
      .entity()
      .set(Position, { x: 0, y: 0 })
      .set(Drawable, {
        zIndex: 10,
        _statements: [{ key: 'lo', priority: 50, fn: () => order.push(10) }],
        _sortedFns: undefined,
      });
    tick();
    expect(order).toEqual([10, 30]);
  });
});
