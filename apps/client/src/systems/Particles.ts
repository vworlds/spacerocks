import type { IPhase, World } from '@vworlds/vecs';
import { Decay, Position, Velocity } from '@spacerocks/common';
import { Alpha } from '../components/Alpha';
import { Particle } from '../components/Particle';

export function installParticleSystem(world: World, phase: IPhase): void {
  world
    .system('Particles')
    .phase(phase)
    .with(Particle, Position, Velocity, Decay)
    .each([Position, Velocity, Decay], (entity, [pos, vel, dec]) => {
      pos.x += vel.vx;
      pos.y += vel.vy;
      dec.life -= dec.decay;
      const alpha = entity.getMut(Alpha);
      if (alpha) alpha.value = Math.max(0, dec.life);
      if (dec.life <= 0) entity.destroy();
    });
}
