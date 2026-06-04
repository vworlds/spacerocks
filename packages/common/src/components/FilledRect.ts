import type { ISerializable } from './ISerializable';
import { type as wireType } from '@vworlds/vecs-wire';

export class FilledRect implements ISerializable {
  @wireType('f64')
  width = 2; // world units

  @wireType('f64')
  height = 2; // world units

  serialize(): Record<string, unknown> {
    return { width: this.width, height: this.height };
  }
}
