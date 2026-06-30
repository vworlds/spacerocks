import { Module } from '@vworlds/vecs';
import { Components } from './components';

/**
 * Registers the shared `SpawnTimer` component used by feature modules
 * (asteroids, aliens, pickups) to schedule periodic spawns. The per-kind
 * clock systems live in their respective feature modules.
 */
export class SpawningModule extends Module {
  override init(): void {
    this.world.module(Components);
  }
}
