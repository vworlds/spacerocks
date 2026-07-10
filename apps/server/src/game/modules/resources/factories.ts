import { type Entity, type World } from '@vworlds/vecs';
import { Networked } from '@vworlds/vecs-server';
import {
  FillStyle,
  Position as RenderPosition,
  Rectangle,
  Size,
} from '@vworlds/vecs-phaser';
import {
  CONTAINER_SIZE,
  RESOURCE_DISPLAY,
  type ResourceType,
  ResourceContainer,
  toResourceWire,
} from '@spacerocks/common';

/**
 * Spawn a resource container entity: a square `Rectangle` with per-type
 * `FillStyle` color and a networked `ResourceContainer` component carrying
 * the resource identity. The client renders the centered character
 * client-side from `ResourceContainer.resourceType` + `RESOURCE_DISPLAY` —
 * no child `Text` entity on the wire.
 *
 * Color derives purely from {@link RESOURCE_DISPLAY} — no literals at the
 * spawn site. The visual flows to the client through the existing render
 * pipeline (`Rectangle` + `FillStyle` for the square) plus a client-side
 * `ResourceContainerRenderModule` that draws the centered letter.
 */
export function createResourceContainer(
  world: World,
  type: ResourceType,
  x: number,
  y: number,
): Entity {
  const display = RESOURCE_DISPLAY[type];
  return world
    .entity()
    .add(Networked)
    .set(RenderPosition, { x, y })
    .add(Rectangle)
    .set(Size, { width: CONTAINER_SIZE, height: CONTAINER_SIZE })
    .set(FillStyle, { color: display.color, alpha: 1 })
    .set(ResourceContainer, { resourceType: toResourceWire(type) });
}
