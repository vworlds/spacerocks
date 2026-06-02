import type { ISerializable } from './ISerializable';
import { type as wireType } from '@vworlds/vecs-wire';

export class FillStyle implements ISerializable {
  @wireType('string')
  style = '#fff';

  serialize(): Record<string, unknown> {
    return { style: this.style };
  }
}
