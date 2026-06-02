import type { ISerializable } from './ISerializable';
import { type as wireType } from '@vworlds/vecs-wire';

export class Arc implements ISerializable {
  @wireType('f64')
  radius = 10;

  @wireType('f64')
  startAngle = 0;

  @wireType('f64')
  endAngle = Math.PI * 2;

  serialize(): Record<string, unknown> {
    return {
      radius: this.radius,
      startAngle: this.startAngle,
      endAngle: this.endAngle,
    };
  }
}
