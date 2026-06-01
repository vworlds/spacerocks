import { world, updatePhase } from '../world';
import { Decay, Alpha } from '../components/index';

world
  .system('DecaySystem')
  .requires(Decay)
  .phase(updatePhase)
  .each([Decay], (e, [dec]) => {
    dec.life -= dec.decay;
    // Sync alpha for particle fade
    const alpha = e.getMut(Alpha);
    if (alpha) alpha.value = Math.max(0, dec.life);
    if (dec.life <= 0) e.destroy();
  });
