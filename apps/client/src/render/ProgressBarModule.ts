import { ChildOf, type Entity, Module, PRE_STORE } from '@vworlds/vecs';
import {
  Container,
  DrawIn,
  FillStyle,
  Offset,
  Rectangle,
  Size,
  StrokeStyle,
} from '@vworlds/vecs-phaser';
import { ProgressBar } from '@spacerocks/common';

const BAR_WIDTH_METERS = 0.3;
const BAR_HEIGHT_METERS = 0.05;
const BAR_BORDER_COLOR = 0x00ff00;
const BAR_BORDER_WIDTH = 1;

export class ProgressBarView {
  border!: Entity;
  fill!: Entity;
}

/** Expands ProgressBar data into client-local vecs-phaser render entities. */
export class ProgressBarModule extends Module {
  override init(): void {
    const world = this.world;
    world.component(ProgressBarView);

    world.component(ProgressBar).onRemove((entity) => {
      const view = entity.get(ProgressBarView);
      view?.border.destroy();
      view?.fill.destroy();

      if (!entity.destroyed) {
        if (entity.has(ProgressBarView)) entity.remove(ProgressBarView);
        if (entity.has(Container)) entity.remove(Container);
      }
    });

    world
      .system('ExpandProgressBar')
      .phase(PRE_STORE)
      .update({ watch: ProgressBar, onEnter: true }, (entity, bar) => {
        let view = entity.get(ProgressBarView);
        if (!view) {
          entity.add(Container);

          const fill = world
            .entity()
            .set(ChildOf, { target: entity })
            .set(DrawIn, { target: entity })
            .add(Rectangle)
            .set(FillStyle, { color: healthColor(bar.value), alpha: 1 });
          const border = world
            .entity()
            .set(ChildOf, { target: entity })
            .set(DrawIn, { target: entity })
            .add(Rectangle)
            .set(Size, {
              width: BAR_WIDTH_METERS,
              height: BAR_HEIGHT_METERS,
            })
            .set(Offset, { x: 0, y: 0 })
            .set(StrokeStyle, {
              color: BAR_BORDER_COLOR,
              alpha: 1,
              width: BAR_BORDER_WIDTH,
            });

          entity.set(ProgressBarView, { border, fill });
          view = { border, fill };
        }

        const ratio = Math.max(0, Math.min(1, bar.value / 100));
        const fillWidth = BAR_WIDTH_METERS * ratio;
        view.fill
          .set(Size, { width: fillWidth, height: BAR_HEIGHT_METERS })
          .set(Offset, {
            x: (fillWidth - BAR_WIDTH_METERS) / 2,
            y: 0,
          })
          .set(FillStyle, { color: healthColor(bar.value), alpha: 1 });
      });
  }
}

function healthColor(value: number): number {
  if (value <= 33) return 0xff0000;
  if (value <= 66) return 0xffff00;
  return 0x00ff00;
}
