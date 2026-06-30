import { Module } from '@vworlds/vecs';
import { NETWORK_COMPONENTS } from './network/schema';

/**
 * Registers every component in the spacerocks network protocol
 * ({@link NETWORK_COMPONENTS}). The server `ServerWorld` and client
 * `ClientWorld` auto-register these at construction; this module lets a plain
 * `World` (e.g. in unit tests) register the same set idempotently.
 */
export class NetworkComponentsModule extends Module {
  override init(): void {
    for (const component of NETWORK_COMPONENTS) {
      this.world.component(component);
    }
  }
}

export { NETWORK_COMPONENTS } from './network/schema';
