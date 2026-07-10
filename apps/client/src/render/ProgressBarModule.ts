import { Module } from '@vworlds/vecs';
import { Position } from '@vworlds/vecs-phaser';
import { CoordSpace } from '@vworlds/vecs-phaser-client';
import { PIXELS_PER_METER, ProgressBar } from '@spacerocks/common';
import type Phaser from 'phaser';

const BAR_WIDTH_METERS = 0.3;
const BAR_HEIGHT_METERS = 0.05;
const BAR_OFFSET_METERS = 0.27;
const BAR_BORDER_COLOR = 0x00ff00;
const BAR_BORDER_WIDTH = 1;

export type ProgressBarModuleConfig = {
  scene: Phaser.Scene;
};

/**
 * Client-side progress bar renderer. When an entity has a `ProgressBar`
 * networked component (value 0–100), draws a bar above it. The server
 * controls visibility by adding/removing the component — no bar when absent.
 *
 * The first use is the ship health bar (combat sets ProgressBar from Health
 * while `healthBarTimer > 0`), but the component is generic — any system
 * can attach it to show progress.
 */
export class ProgressBarModule extends Module<ProgressBarModuleConfig> {
  override init(config: ProgressBarModuleConfig): void {
    const { scene } = config;
    const coords = new CoordSpace(scene, PIXELS_PER_METER);
    const barWidthPx = BAR_WIDTH_METERS * PIXELS_PER_METER;
    const barHeightPx = BAR_HEIGHT_METERS * PIXELS_PER_METER;
    const offsetY = BAR_OFFSET_METERS;
    const graphicsByEntity = new Map<number, Phaser.GameObjects.Graphics>();

    this.world
      .system('ProgressBarRender')
      .with(ProgressBar, Position)
      .each([ProgressBar, Position], (entity, [bar, position]) => {
        let graphics = graphicsByEntity.get(entity.eid);
        if (!graphics) {
          graphics = scene.add.graphics();
          graphicsByEntity.set(entity.eid, graphics);
        }

        const x = coords.x(position.x);
        const y = coords.y(position.y + offsetY);
        const ratio = bar.value / 100;
        const color = healthColor(bar.value);

        graphics.clear();
        graphics.lineStyle(BAR_BORDER_WIDTH, BAR_BORDER_COLOR, 1);
        graphics.strokeRect(
          x - barWidthPx / 2,
          y - barHeightPx / 2,
          barWidthPx,
          barHeightPx,
        );
        graphics.fillStyle(color, 1);
        graphics.fillRect(
          x - barWidthPx / 2,
          y - barHeightPx / 2,
          barWidthPx * ratio,
          barHeightPx,
        );
      })
      .exit([], (entity) => {
        const graphics = graphicsByEntity.get(entity.eid);
        if (graphics) {
          graphics.destroy();
          graphicsByEntity.delete(entity.eid);
        }
      });
  }
}

function healthColor(value: number): number {
  if (value <= 33) return 0xff0000;
  if (value <= 66) return 0xffff00;
  return 0x00ff00;
}
