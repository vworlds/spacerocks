import type { ISerializable } from './ISerializable';
import { type as wireType } from '@vworlds/vecs-wire';

export class StrokeStyle implements ISerializable {
  @wireType('string')
  style = '#fff';

  @wireType('f64')
  lineWidth = 2; // pixels

  serialize(): Record<string, unknown> {
    return { style: this.style, lineWidth: this.lineWidth };
  }
}
