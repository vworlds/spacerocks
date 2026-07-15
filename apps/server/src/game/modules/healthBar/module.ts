import { Module, OwnedTarget } from '@vworlds/vecs';
import { DrawBy, Offset, Position } from '@vworlds/vecs-phaser';
import { Networked } from '@vworlds/vecs-server';
import { ProgressBar } from '@spacerocks/common';
import { Components as CombatComponents, Health } from '../combat/components';
import { HealthBar } from './components';

const HEALTH_BAR_OFFSET_METERS = 0.27;

export class HealthBarModule extends Module {
  override init(): void {
    const world = this.world;
    world.module(CombatComponents);
    world.component(HealthBar).add(OwnedTarget);

    world
      .system('ProjectHealthBar')
      .with(Position, Health, HealthBar)
      .enter((entity) => {
        const target = entity.target(HealthBar);
        if (!target) return;

        target
          .add(Networked)
          .set(DrawBy, { target: entity })
          .set(Offset, { x: 0, y: HEALTH_BAR_OFFSET_METERS });
      })
      .update({ watch: Health, onEnter: true }, (entity, health) => {
        const target = entity.target(HealthBar);
        if (!target) return;

        if (health.maxHp <= 0) {
          if (target.has(ProgressBar)) target.remove(ProgressBar);
          return;
        }

        const value = Math.round(
          Math.max(0, Math.min(1, health.hp / health.maxHp)) * 100,
        );
        target.set(ProgressBar, { value });
      })
      .exit((entity) => {
        const target = entity.target(HealthBar);
        if (target?.has(ProgressBar)) target.remove(ProgressBar);
      });
  }
}
