import type { ISerializable } from './ISerializable';
import { type as wireType } from '@vworlds/vecs-wire';
import { Point } from './Point';

export class Shape implements ISerializable {
  @wireType([Point])
  points: Point[] = [];

  serialize(): Record<string, unknown> {
    return { points: this.points };
  }
}
