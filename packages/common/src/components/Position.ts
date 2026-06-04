import type { ISerializable } from './ISerializable';
import { type as wireType } from '@vworlds/vecs-wire';

export class Position implements ISerializable {
  @wireType('f64')
  x = 0; // world units

  @wireType('f64')
  y = 0; // world units

  serialize(): Record<string, unknown> {
    return { x: this.x, y: this.y };
  }
}
