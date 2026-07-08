import { Module } from '@vworlds/vecs';
import { Components as ResourcesComponents } from './components';

/**
 * Resource container module: registers the server-only `ResourceContainer`
 * component. The container spawn factory lives in `./factories` and is called
 * by gameplay systems (loot, buffers — E3/E4/E5); this module only owns the
 * component registration so worlds that don't spawn containers don't pay for it.
 */
export class ResourcesModule extends Module {
  override init(): void {
    this.world.module(ResourcesComponents);
  }
}
