import type { IPhase, World } from '@vworlds/vecs';
import {
  Decay,
  Drawable,
  ExplosionView,
  FillStyle,
  FilledRect,
  Position,
  Velocity,
} from '@spacerocks/common';
import { Alpha } from '../components/Alpha';
import { Particle } from '../components/Particle';

const MIN_PARTICLES = 8; // particles
const MAX_PARTICLES = 36; // particles

export function installExplosionSystem(world: World, phase: IPhase): void {
  world
    .system('Explosion')
    .phase(phase)
    .with(Position, ExplosionView)
    .enter([Position, ExplosionView], (_entity, [position, explosion]) => {
      spawnExplosionParticles(world, position, explosion);
    });
}

function spawnExplosionParticles(
  world: World,
  position: Position,
  explosion: ExplosionView,
): void {
  const count = Math.max(
    MIN_PARTICLES,
    Math.min(MAX_PARTICLES, Math.round(explosion.size)),
  );
  const random = seededRandom(explosion.seed);
  const speed = Math.max(1, explosion.size / 8);
  const duration = Math.max(1, explosion.duration);

  for (let i = 0; i < count; i++) {
    const angle = random() * Math.PI * 2;
    const magnitude = speed * (0.35 + random() * 0.65);
    const side = 1 + random() * Math.max(1, explosion.size / 10);
    world
      .entity()
      .set(Position, { x: position.x, y: position.y })
      .set(Velocity, {
        vx: Math.cos(angle) * magnitude,
        vy: Math.sin(angle) * magnitude,
      })
      .add(Particle)
      .set(Decay, { life: 1, decay: 1 / duration })
      .set(Drawable, { zIndex: 10 })
      .set(Alpha, { value: 1 })
      .set(FillStyle, { style: explosion.color })
      .set(FilledRect, { width: side, height: side });
  }
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}
