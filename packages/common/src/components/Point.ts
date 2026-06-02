import { type as wireType } from '@vworlds/vecs-wire';

export class Point {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  @wireType('f64')
  x = 0;

  @wireType('f64')
  y = 0;
}
