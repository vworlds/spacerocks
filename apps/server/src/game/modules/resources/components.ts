import { Module } from '@vworlds/vecs';
import { Components as EmbellishmentsComponents } from '../embellishments/components';

/**
 * Server-side gameplay component marking an entity as a resource container of
 * a given {@link ResourceType} (design #40 §8.1). Carries the identity so
 * server systems (loot, buffers, trains in E3/E4/E5) can react to a container's
 * type without re-deriving it from the render color.
 *
 * This is a SERVER-ONLY component — it is NOT in `NETWORK_COMPONENTS`. The
 * client renders the container purely from the `Rectangle` + `FillStyle`
 * (color) and `Text` (centered char) render components it already receives;
 * it never needs the `ResourceType` enum on the wire. Per the E1-T3 wire
 * decision: derive the visual purely from existing render components.
 */
export class ResourceContainer {
  /** The resource identity of this container. */
  type = 'ore' as 'ore' | 'crystal' | 'alloy';
}

/**
 * Registers the `ResourceContainer` server-only component, and (idempotently)
 * the embellishment components — `createResourceContainer` gives the character
 * child `FollowParent` + `Offset` so it tracks a moving container, and those
 * component classes must be registered wherever containers are spawned.
 */
export class Components extends Module {
  override init(): void {
    this.world.module(EmbellishmentsComponents);
    this.world.component(ResourceContainer);
  }
}
