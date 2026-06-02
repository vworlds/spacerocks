import { type as wireType } from '@vworlds/vecs-wire';

export class Point {
  @wireType('f64')
  x = 0;

  @wireType('f64')
  y = 0;
}
