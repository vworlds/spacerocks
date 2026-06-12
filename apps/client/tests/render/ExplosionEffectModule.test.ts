import { World } from '@vworlds/vecs';
import { Position } from '@vworlds/vecs-phaser';
import { Explosion } from '@spacerocks/common';
import { describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { ExplosionEffectModule } from '../../src/render/ExplosionEffectModule';

vi.mock('@vworlds/vecs-phaser-client', () => ({
  CoordSpace: class CoordSpace {
    constructor(
      private readonly scene: Phaser.Scene,
      private readonly ppm: number,
    ) {}

    x(value: number): number {
      return this.scene.scale.width / 2 + this.ppm * value;
    }

    y(value: number): number {
      return this.scene.scale.height / 2 - this.ppm * value;
    }

    len(value: number): number {
      return this.ppm * value;
    }
  },
}));

function createSceneMock(): Phaser.Scene {
  const emitter = {
    explode: vi.fn(),
    destroy: vi.fn(),
  };
  const graphics = {
    fillStyle: vi.fn(),
    fillRect: vi.fn(),
    generateTexture: vi.fn(),
    destroy: vi.fn(),
  };

  return {
    scale: { width: 1024, height: 768 },
    textures: { exists: vi.fn(() => false) },
    add: {
      graphics: vi.fn(() => graphics),
      particles: vi.fn(() => emitter),
    },
    time: {
      delayedCall: vi.fn((_delay: number, callback: () => void) => callback()),
    },
  } as unknown as Phaser.Scene;
}

describe('ExplosionEffectModule', () => {
  it('emits one mocked particle burst for a networked Explosion entity', () => {
    const world = new World();
    world.component(Position);
    world.component(Explosion);
    const scene = createSceneMock();

    world.module(ExplosionEffectModule, { scene });
    world.entity().set(Position, { x: 1, y: 2 }).set(Explosion, {
      color: 0xffcc00,
      size: 0.2,
      seed: 1,
      duration: 0.5,
    });
    world.progress(16, 16);

    expect(scene.add.particles).toHaveBeenCalledOnce();
  });
});
