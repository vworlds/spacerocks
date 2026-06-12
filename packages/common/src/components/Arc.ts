import type { ISerializable } from './ISerializable';
import { type as wireType } from '@vworlds/vecs-wire';

export class Arc implements ISerializable {
  @wireType('f64')
  radius = 0.1; // meters

  @wireType('f64')
  startAngle = 0; // radians

  @wireType('f64')
  endAngle = Math.PI * 2; // radians

  serialize(): Record<string, unknown> {
    return {
      radius: this.radius,
      startAngle: this.startAngle,
      endAngle: this.endAngle,
    };
  }
}
