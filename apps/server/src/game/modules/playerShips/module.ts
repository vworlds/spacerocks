import { Module } from '@vworlds/vecs';
import { Components as CombatComponents } from '../combat/components';
import { Components as MovementComponents } from '../movement/components';
import { Components as PlayerSessionsComponents } from '../playerSessions/components';
import { Components as WeaponsComponents } from '../weapons/components';
import { Components } from './components';

/**
 * Registers the player ship archetype and the components its factory sets.
 */
export class PlayerShipsModule extends Module {
  override init(): void {
    this.world.module(CombatComponents);
    this.world.module(MovementComponents);
    this.world.module(PlayerSessionsComponents);
    this.world.module(WeaponsComponents);
    this.world.module(Components);
  }
}
