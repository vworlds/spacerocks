import { Module } from '@vworlds/vecs';
import { Position } from '@vworlds/vecs-phaser';
import { CoordSpace } from '@vworlds/vecs-phaser-client';
import { Explosion, PIXELS_PER_METER } from '@spacerocks/common';
import type Phaser from 'phaser';

const SPARK_TEXTURE_KEY = 'spacerocks-spark';
const MIN_PARTICLES = 8;
const MAX_PARTICLES = 36;

export type ExplosionEffectModuleConfig = {
  scene: Phaser.Scene;
};

export class ExplosionEffectModule extends Module<ExplosionEffectModuleConfig> {
  override init(config: ExplosionEffectModuleConfig): void {
    const { scene } = config;
    const coords = new CoordSpace(scene, PIXELS_PER_METER);

    ensureSparkTexture(scene);

    this.world
      .system('ExplosionEffect')
      .with(Explosion)
      .enter([Explosion, Position], (_entity, [explosion, position]) => {
        const x = coords.x(position.x);
        const y = coords.y(position.y);
        const count = clamp(
          Math.round(explosion.size * 100 * 1.8),
          MIN_PARTICLES,
          MAX_PARTICLES,
        );
        const lifespan = Math.max(1, explosion.duration * 1000);
        const speed = Math.max(20, coords.len(explosion.size) * 2.5);
        const scale = Math.max(0.75, explosion.size * 2);

        const emitter = scene.add.particles(x, y, SPARK_TEXTURE_KEY, {
          alpha: { start: 1, end: 0 },
          emitting: false,
          lifespan,
          quantity: 0,
          scale: { start: scale, end: 0 },
          speed: { min: speed * 0.35, max: speed },
          tint: explosion.color,
        });

        emitter.explode(count);
        scene.time.delayedCall(lifespan + 50, () => emitter.destroy());
      });
  }
}

function ensureSparkTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(SPARK_TEXTURE_KEY)) {
    return;
  }

  const graphics = scene.add.graphics();
  graphics.fillStyle(0xffffff, 1);
  graphics.fillRect(0, 0, 3, 3);
  graphics.generateTexture(SPARK_TEXTURE_KEY, 3, 3);
  graphics.destroy();
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
