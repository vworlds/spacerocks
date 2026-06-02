import { describe, expect, it, vi } from 'vitest';
import {
  createWorld,
  Arc,
  CLIENT_ENTITY_ID_START,
  Decay,
  Drawable,
  ExplosionView,
  FillStyle,
  FilledRect,
  HealthView,
  Position,
  Rotation,
  Shape,
  ShieldView,
  StrokeStyle,
  Velocity,
  WeaponView,
} from '@spacerocks/common';
import { Alpha, Particle } from '@src/components';
import {
  clearExplosionMarkerVisitCache,
  drawNetworkRenderableEntity,
  spawnLocalExplosionParticlesFromMarkers,
} from '@src/systems/NetworkRender';

vi.mock('@src/network/vecsClient', () => ({
  getVecsClientWorld: () => null,
}));

function createMockCtx() {
  return {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
  };
}

function createNetworkWorld() {
  const world = createWorld();
  world.component(HealthView);
  world.component(ShieldView);
  world.component(WeaponView);
  world.component(ExplosionView);
  return world;
}

function createLocalWorld() {
  const world = createWorld({ entityIdStart: CLIENT_ENTITY_ID_START });
  world.component(Velocity);
  world.component(Decay);
  world.component(Alpha);
  world.component(Particle);
  return world;
}

describe('NetworkRender', () => {
  it('maps fixed world coordinates to the canvas before drawing', () => {
    const networkWorld = createNetworkWorld();
    const entity = networkWorld
      .entity()
      .set(Position, { x: 512, y: 384 })
      .set(Rotation, { angle: Math.PI / 2 })
      .set(Drawable, { zIndex: 10 })
      .set(Shape, { points: [{ x: 1, y: 0 }] });
    const ctx = createMockCtx();

    drawNetworkRenderableEntity(
      ctx as unknown as CanvasRenderingContext2D,
      entity,
      { x: 2, y: 2 },
    );

    expect(ctx.translate).toHaveBeenCalledWith(1024, 768);
    expect(ctx.rotate).toHaveBeenCalledWith(Math.PI / 2);
    expect(ctx.scale).toHaveBeenCalledWith(2, 2);
  });

  it('reconstructs shape draw statements from network components', () => {
    const networkWorld = createNetworkWorld();
    const entity = networkWorld
      .entity()
      .set(Position, { x: 0, y: 0 })
      .set(Drawable, { zIndex: 10 })
      .set(StrokeStyle, { style: '#0ff', lineWidth: 3 })
      .set(Shape, {
        points: [
          { x: 15, y: 0 },
          { x: -10, y: 10 },
          { x: -10, y: -10 },
        ],
      });
    const ctx = createMockCtx();

    drawNetworkRenderableEntity(
      ctx as unknown as CanvasRenderingContext2D,
      entity,
      { x: 1, y: 1 },
    );

    expect(ctx.strokeStyle).toBe('#0ff');
    expect(ctx.lineWidth).toBe(3);
    expect(ctx.moveTo).toHaveBeenCalledWith(15, 0);
    expect(ctx.lineTo).toHaveBeenCalledWith(-10, 10);
    expect(ctx.lineTo).toHaveBeenCalledWith(-10, -10);
    expect(ctx.closePath).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it('reconstructs arc fill draw statements from network components', () => {
    const networkWorld = createNetworkWorld();
    const entity = networkWorld
      .entity()
      .set(Position, { x: 0, y: 0 })
      .set(Drawable, { zIndex: 10 })
      .set(FillStyle, { style: '#f00' })
      .set(Arc, { radius: 2, startAngle: 0, endAngle: Math.PI });
    const ctx = createMockCtx();

    drawNetworkRenderableEntity(
      ctx as unknown as CanvasRenderingContext2D,
      entity,
      { x: 1, y: 1 },
    );

    expect(ctx.fillStyle).toBe('#f00');
    expect(ctx.arc).toHaveBeenCalledWith(0, 0, 2, 0, Math.PI);
    expect(ctx.fill).toHaveBeenCalled();
  });

  it('reconstructs filled rect draw statements from mirrored entities', () => {
    const networkWorld = createNetworkWorld();
    const entity = networkWorld
      .entity()
      .set(Position, { x: 5, y: 6 })
      .set(Drawable, { zIndex: 10 })
      .set(FillStyle, { style: '#0f0' })
      .set(FilledRect, { width: 4, height: 6 });
    const ctx = createMockCtx();

    drawNetworkRenderableEntity(
      ctx as unknown as CanvasRenderingContext2D,
      entity,
      { x: 1, y: 1 },
    );

    expect(ctx.translate).toHaveBeenCalledWith(5, 6);
    expect(ctx.fillStyle).toBe('#0f0');
    expect(ctx.fillRect).toHaveBeenCalledWith(-2, -3, 4, 6);
  });

  it('draws mirrored health bars, shields, and active laser beams', () => {
    const networkWorld = createNetworkWorld();
    const entity = networkWorld
      .entity()
      .set(Position, { x: 0, y: 0 })
      .set(Drawable, { zIndex: 10 })
      .set(HealthView, { hp: 50, maxHp: 100, barTimer: 10 })
      .set(ShieldView, { remainingTime: 1200 })
      .set(WeaponView, { activeWeapon: 1, ammo: 3, firing: 1 });
    const ctx = createMockCtx();

    drawNetworkRenderableEntity(
      ctx as unknown as CanvasRenderingContext2D,
      entity,
      { x: 1, y: 1 },
    );

    expect(ctx.lineTo).toHaveBeenCalledWith(1024, 0);
    expect(ctx.strokeRect).toHaveBeenCalledWith(-15, -27, 30, 5);
    expect(ctx.fillRect).toHaveBeenCalledWith(-15, -27, 15, 5);
    expect(ctx.arc).toHaveBeenCalledWith(0, 0, 20, 0, Math.PI * 2);
  });

  it('spawns deterministic client-local particles when explosion markers appear', () => {
    clearExplosionMarkerVisitCache();
    const networkWorld = createNetworkWorld();
    const localWorld = createLocalWorld();
    const marker = networkWorld
      .entity()
      .set(Position, { x: 25, y: 40 })
      .set(ExplosionView, {
        color: '#fa0',
        size: 12,
        seed: 123,
        duration: 30,
      });

    const spawned = spawnLocalExplosionParticlesFromMarkers(
      [marker],
      localWorld,
    );
    const spawnedAgain = spawnLocalExplosionParticlesFromMarkers(
      [marker],
      localWorld,
    );

    const particles = [...localWorld.entities.values()].filter((entity) =>
      entity.get(Particle),
    );
    expect(spawned).toBe(12);
    expect(spawnedAgain).toBe(0);
    expect(particles).toHaveLength(12);
    expect(
      particles.every((entity) => entity.eid >= CLIENT_ENTITY_ID_START),
    ).toBe(true);
    expect(particles[0]?.get(Position)).toMatchObject({ x: 25, y: 40 });
    expect(particles[0]?.get(FillStyle)).toMatchObject({ style: '#fa0' });
    expect(particles[0]?.get(FilledRect)?.width).toBeGreaterThan(1);
    expect(particles[0]?.get(Decay)).toMatchObject({ life: 1, decay: 1 / 30 });
    expect(particles[0]?.get(Velocity)).toMatchObject({
      vx: -0.1997144327000843,
      vy: 0.9280048889903895,
    });
  });
});
