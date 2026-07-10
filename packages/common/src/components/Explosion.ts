import { wireType } from '@vworlds/vecs-wire';

export class Explosion {
  @wireType('u32')
  color = 0xffffff;

  @wireType('f32')
  size = 1;

  @wireType('u32')
  seed = 0;

  @wireType('f32')
  duration = 0.5;
}
