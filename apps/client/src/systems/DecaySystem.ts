import { world, updatePhase } from '../world';
import {
  Alpha,
  Decay,
  Particle,
  Position,
  Velocity,
} from '../components/index';

world
  .system('LocalParticleSystem')
  .requires(Particle, Position, Velocity, Decay)
  .phase(updatePhase)
  .each([Position, Velocity, Decay], (e, [pos, vel, dec]) => {
    pos.x += vel.vx;
    pos.y += vel.vy;
    dec.life -= dec.decay;
    const alpha = e.getMut(Alpha);
    if (alpha) alpha.value = Math.max(0, dec.life);
    if (dec.life <= 0) e.destroy();
  });
