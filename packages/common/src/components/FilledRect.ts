import type { ISerializable } from './ISerializable';
import { type as wireType } from '@vworlds/vecs-wire';

export class FilledRect implements ISerializable {
  @wireType('f64')
  width = 0.02; // meters

  @wireType('f64')
  height = 0.02; // meters

  serialize(): Record<string, unknown> {
    return { width: this.width, height: this.height };
  }
}
