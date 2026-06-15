import { type as wireType } from '@vworlds/vecs-wire';

export class PlayerShip {
  @wireType('u32')
  playerIndex = 0; // player index

  @wireType('u32')
  color = 0xffffff; // u32 RGB
}

export class AsteroidView {
  @wireType('u32')
  color = 0x888888; // u32 RGB

  @wireType('f64')
  radius = 0.2; // meters

  @wireType('f64')
  mass = 16; // kg
}

export class GameStateView {
  @wireType('u32')
  state = 0; // enum id

  @wireType('u32')
  wave = 0; // wave number

  @wireType('u32')
  score = 0; // points

  @wireType('string')
  status = '';
}
