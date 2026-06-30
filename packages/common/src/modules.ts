import { Module } from '@vworlds/vecs';
import { NETWORK_COMPONENTS } from './network/schema';

/**
 * Registers the shared network protocol components. Server-only gameplay
 * components are owned and registered by their feature modules.
 */
export class NetworkComponentsModule extends Module {
  override init(): void {
    for (const component of NETWORK_COMPONENTS) {
      this.world.component(component);
    }
  }
}

export { NETWORK_COMPONENTS } from './network/schema';
