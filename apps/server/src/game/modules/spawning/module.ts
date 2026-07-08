import { Module } from '@vworlds/vecs';
import { Components } from './components';

/**
 * Registers the shared `SpawnTimer` component used by feature modules to
 * schedule periodic spawns. The per-kind clock systems live in their
 * respective feature modules. (E1-T4: aliens/pickups clocks are retired;
 * the component scaffolding stays for reuse.)
 */
export class SpawningModule extends Module {
  override init(): void {
    this.world.module(Components);
  }
}
