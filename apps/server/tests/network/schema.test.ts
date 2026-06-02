import { describe, expect, it } from 'vitest';
import {
  Arc,
  AsteroidView,
  Drawable,
  ExplosionView,
  FillStyle,
  FilledRect,
  GameStateView,
  HealthView,
  NETWORK_COMPONENTS,
  PickupView,
  PlayerShip,
  Position,
  ProjectileView,
  Rotation,
  Shape,
  ShieldView,
  StrokeStyle,
  WeaponView,
} from '@spacerocks/common';

describe('server network schema', () => {
  it('imports the shared schema in protocol order with Position type id 1', () => {
    expect(NETWORK_COMPONENTS).toEqual([
      Position,
      Rotation,
      Drawable,
      StrokeStyle,
      FillStyle,
      Shape,
      Arc,
      FilledRect,
      PlayerShip,
      AsteroidView,
      ProjectileView,
      PickupView,
      HealthView,
      ShieldView,
      WeaponView,
      GameStateView,
      ExplosionView,
    ]);
    expect(NETWORK_COMPONENTS.indexOf(Position) + 1).toBe(1);
  });
});
