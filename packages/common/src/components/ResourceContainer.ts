import { wireType } from '@vworlds/vecs-wire';
import type { ResourceType } from '../resources';

/**
 * Networked component marking an entity as a resource container of a given
 * {@link ResourceType} (design #40 §8.1). The client reads `resourceType`
 * to draw the centered character and color from `RESOURCE_DISPLAY`.
 *
 * Wire encoding: `resourceType` is a `u8` enum (0=ore, 1=crystal, 2=alloy)
 * matching the `RESOURCE_TYPES` tuple order.
 */
export class ResourceContainer {
  @wireType('u8')
  resourceType: ResourceWireType = 0;
}

/** Wire encoding of ResourceType (index into RESOURCE_TYPES). */
export type ResourceWireType = 0 | 1 | 2;

/** Map a ResourceType to its wire index. */
export function toResourceWire(type: ResourceType): ResourceWireType {
  return type === 'ore' ? 0 : type === 'crystal' ? 1 : 2;
}

/** Map a wire index back to a ResourceType. */
export function fromResourceWire(wire: ResourceWireType): ResourceType {
  return wire === 0 ? 'ore' : wire === 1 ? 'crystal' : 'alloy';
}
