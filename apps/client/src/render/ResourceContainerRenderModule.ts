import { Module } from '@vworlds/vecs';
import { Position } from '@vworlds/vecs-phaser';
import { CoordSpace } from '@vworlds/vecs-phaser-client';
import {
  PIXELS_PER_METER,
  RESOURCE_DISPLAY,
  ResourceContainer,
  fromResourceWire,
} from '@spacerocks/common';
import type Phaser from 'phaser';

const FONT_FAMILY = 'monospace';
const FONT_SIZE = 14;

export type ResourceContainerRenderModuleConfig = {
  scene: Phaser.Scene;
};

/**
 * Client-side resource container character renderer. When an entity has a
 * networked `ResourceContainer` component, draws the centered resource
 * character on top of the square (the square itself renders via the standard
 * `Rectangle` + `FillStyle` render pipeline). The character and color derive
 * from `RESOURCE_DISPLAY` keyed by the wire `resourceType`.
 */
export class ResourceContainerRenderModule extends Module<ResourceContainerRenderModuleConfig> {
  override init(config: ResourceContainerRenderModuleConfig): void {
    const { scene } = config;
    const coords = new CoordSpace(scene, PIXELS_PER_METER);
    const textByEntity = new Map<number, Phaser.GameObjects.Text>();

    this.world
      .system('ResourceContainerCharRender')
      .with(ResourceContainer, Position)
      .each([ResourceContainer, Position], (entity, [container, position]) => {
        const type = fromResourceWire(container.resourceType);
        const display = RESOURCE_DISPLAY[type];

        let text = textByEntity.get(entity.eid);
        if (!text) {
          text = scene.add.text(0, 0, display.char, {
            fontFamily: FONT_FAMILY,
            fontSize: `${FONT_SIZE}px`,
            color: '#000000',
            align: 'center',
          });
          text.setOrigin(0.5, 0.5);
          textByEntity.set(entity.eid, text);
        } else if (text.text !== display.char) {
          text.setText(display.char);
        }

        const cx = coords.x(position.x);
        const cy = coords.y(position.y);
        text.setPosition(cx, cy);
      })
      .exit([], (entity) => {
        const text = textByEntity.get(entity.eid);
        if (text) {
          text.destroy();
          textByEntity.delete(entity.eid);
        }
      });
  }
}
