import type { ISerializable } from './ISerializable';
import { type as wireType } from '@vworlds/vecs-wire';

export class Rotation implements ISerializable {
  @wireType('f64')
  angle = 0;

  serialize(): Record<string, unknown> {
    return { angle: this.angle };
  }
}
