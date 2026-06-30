import { Module } from '@vworlds/vecs';
import { Components, Decay } from './components';

export class DecayModule extends Module {
  override init(): void {
    this.world.module(Components);

    this.world
      .system('Decay')
      .with(Decay)
      .each([Decay], (entity, [decay]) => {
        decay.life -= decay.decay;
        if (decay.life <= 0) entity.destroy();
      });
  }
}
