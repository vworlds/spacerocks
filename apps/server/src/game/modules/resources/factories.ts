import { ChildOf, type Entity, type World } from '@vworlds/vecs';
import { Networked } from '@vworlds/vecs-server';
import {
  FillStyle,
  Position as RenderPosition,
  Rectangle,
  Size,
  Text,
  TextAlign,
} from '@vworlds/vecs-phaser';
import {
  CONTAINER_SIZE,
  RESOURCE_DISPLAY,
  type ResourceType,
} from '@spacerocks/common';
import { FollowParent, Offset } from '../embellishments/components';
import { ResourceContainer } from './components';

/** Font for the centered container character (retro look, design #40 §8.1). */
const CONTAINER_FONT_FAMILY = 'monospace';
/** Font size in screen pixels for the centered container character. */
const CONTAINER_FONT_SIZE = 14;

/**
 * Spawn a resource container entity: a square `Rectangle` (per-type
 * `FillStyle` color) with a **child entity** carrying the centered `Text`
 * character. Mirrors how `embellishments/module.ts` composes child visuals
 * via `ChildOf` + `Networked`.
 *
 * Color and character derive purely from {@link RESOURCE_DISPLAY} — no
 * literals at the spawn site. The visual flows to the client through the
 * existing render pipeline (no per-entity render code, no new networked
 * component).
 *
 * The character child carries `FollowParent` + a zero `Offset` so the
 * embellishments `ApplyEmbellishmentLocalPositions` cascade keeps its
 * `RenderPosition` pinned to the square's centre every tick — the character
 * tracks the container once it starts moving (FREE drift, TRAINED convoy;
 * E3/E4). `FollowParentRotation` is intentionally omitted so the letter stays
 * upright and readable while the square may rotate. Requires
 * `EmbellishmentsModule` (installed by `WorldModule` before `ResourcesModule`).
 */
export function createResourceContainer(
  world: World,
  type: ResourceType,
  x: number,
  y: number,
): Entity {
  const display = RESOURCE_DISPLAY[type];
  const parent = world
    .entity()
    .add(Networked)
    .set(RenderPosition, { x, y })
    .add(Rectangle)
    .set(Size, { width: CONTAINER_SIZE, height: CONTAINER_SIZE })
    .set(FillStyle, { color: display.color, alpha: 1 })
    .set(ResourceContainer, { type });

  world
    .entity()
    .add(Networked)
    .set(ChildOf, { target: parent })
    .set(RenderPosition, { x, y })
    .add(Text)
    .set(Text, {
      value: display.char,
      fontFamily: CONTAINER_FONT_FAMILY,
      fontSize: CONTAINER_FONT_SIZE,
      color: 0x000000,
      backgroundColor: 0,
      backgroundAlpha: 0,
      align: TextAlign.Center,
    })
    .add(FollowParent)
    .set(Offset, { x: 0, y: 0 });

  return parent;
}
