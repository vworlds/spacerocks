import { ON_STORE, type World } from '@vworlds/vecs';
import { Drawable } from '@spacerocks/common';
import { Label } from '../../components/Label';

export function installLabelDrawSystem(world: World): void {
  world
    .system('LabelDraw')
    .phase(ON_STORE)
    .with(Drawable, Label)
    .enter([Drawable, Label], (_entity, [drawable, label]) => {
      drawable.addStatement(Label, 60, (ctx) => {
        ctx.fillStyle = label.color;
        ctx.font = label.font;
        ctx.textAlign = label.textAlign;
        ctx.textBaseline = label.textBaseline;
        ctx.fillText(label.text, 0, 0);
      });
    })
    .exit([Drawable], (_entity, [drawable]) => {
      drawable.removeStatement(Label);
    });
}
