import { ChildOf, World, type Entity } from '@vworlds/vecs';
import {
  Alpha,
  Arc,
  FillStyle,
  Line,
  Position,
  Rectangle,
  Rotation,
  Size,
  StrokeStyle,
} from '@vworlds/vecs-phaser';
import {
  COLORS,
  ENTITY_CONFIG,
  Health,
  LaserWeapon,
  NetworkComponentsModule,
  Shield,
} from '@spacerocks/common';
import { describe, expect, it, vi } from 'vitest';
import { Networked } from '@vworlds/vecs-server';
import {
  Components as EmbellishmentsComponents,
  Embellishments,
  FollowParent,
  FollowParentRotation,
  Offset,
} from '../../../src/game/modules/embellishments/components';
import {
  EmbellishmentsModule,
  rgbToU32,
} from '../../../src/game/modules/embellishments/module';
import { Components as PlayerSessionsComponents } from '../../../src/game/modules/playerSessions/components';
import { Components as WeaponsComponents } from '../../../src/game/modules/weapons/components';
import { Components as AsteroidsComponents } from '../../../src/game/modules/asteroids/components';
import { Components as AliensComponents } from '../../../src/game/modules/aliens/components';

vi.mock('@vworlds/vecs-server', () => ({
  NetworkClient: class NetworkClient {
    id = '';
  },
  NetworkInput: class NetworkInput {
    input: unknown;
  },
  Networked: class Networked {},
}));

function createTestWorld(): World {
  const world = new World();
  world.module(NetworkComponentsModule);
  world.component(Networked);
  world.module(PlayerSessionsComponents);
  world.module(WeaponsComponents);
  world.module(AsteroidsComponents);
  world.module(AliensComponents);
  world.module(EmbellishmentsComponents);
  world.module(EmbellishmentsModule);
  return world;
}

function runFrame(world: World, frame = 0): void {
  world.progress(frame * (1000 / 60), 1000 / 60);
}

function createParent(world: World): Entity {
  return world
    .entity()
    .set(Position, { x: 1, y: 2 })
    .set(Rotation, { angle: Math.PI / 4 });
}

describe('server embellishment child entities', () => {
  it('creates health bar children and follows the parent position', () => {
    const world = createTestWorld();
    const parent = createParent(world).set(Health, {
      hp: 100,
      maxHp: 100,
      healthBarTimer: 0,
    });

    runFrame(world);

    const refs = parent.get(Embellishments)!;
    expect(refs.healthBar?.get(ChildOf)?.target).toBe(parent);
    expect(refs.healthBar?.get(Rectangle)).toBeDefined();
    expect(refs.healthBar?.get(Size)).toMatchObject({
      width: 0.3,
      height: 0.05,
    });
    expect(refs.healthBar?.get(StrokeStyle)).toMatchObject({
      color: COLORS.healthGreen,
      alpha: 1,
      width: 1,
    });
    expect(refs.healthBar?.get(Offset)).toMatchObject({ x: 0, y: 0.27 });
    expect(refs.healthBar?.get(FollowParent)).toBeDefined();
    expect(refs.healthBar?.get(Alpha)).toMatchObject({ value: 0 });

    expect(refs.healthBarFill?.get(ChildOf)?.target).toBe(parent);
    expect(refs.healthBarFill?.get(Rectangle)).toBeDefined();
    expect(refs.healthBarFill?.get(Size)).toMatchObject({
      width: 0.3,
      height: 0.05,
    });
    expect(refs.healthBarFill?.get(FillStyle)).toMatchObject({
      color: COLORS.healthGreen,
      alpha: 1,
    });

    parent.set(Position, { x: 3, y: 4 });
    runFrame(world, 1);

    expect(refs.healthBar?.get(Position)).toMatchObject({ x: 3, y: 4.27 });
    expect(refs.healthBarFill?.get(Position)).toMatchObject({ x: 3, y: 4.27 });
  });

  it('updates health fill width, left alignment, color, and visibility', () => {
    const world = createTestWorld();
    const parent = createParent(world).set(Health, {
      hp: 100,
      maxHp: 100,
      healthBarTimer: 0,
    });

    runFrame(world);
    const fill = parent.get(Embellishments)!.healthBarFill!;
    const border = parent.get(Embellishments)!.healthBar!;
    parent.set(Health, { hp: 25, maxHp: 100, healthBarTimer: 5 });

    runFrame(world, 1);

    expect(fill.get(Size)).toMatchObject({ width: 0.075, height: 0.05 });
    expect(fill.get(Offset)).toMatchObject({
      x: -0.11249999999999999,
      y: 0.27,
    });
    expect(fill.get(FillStyle)).toMatchObject({ color: 0xff0000 });
    expect(fill.get(Alpha)).toMatchObject({ value: 1 });
    expect(border.get(Alpha)).toMatchObject({ value: 1 });
  });

  it('creates and destroys shield ring with Shield lifecycle', () => {
    const world = createTestWorld();
    const parent = createParent(world).set(Shield, {
      shieldTime: ENTITY_CONFIG.SHIP.SHIELD_DURATION,
    });

    runFrame(world);

    const ring = parent.get(Embellishments)!.shieldRing!;
    expect(ring.get(ChildOf)?.target).toBe(parent);
    expect(ring.get(Arc)).toMatchObject({
      radius: ENTITY_CONFIG.SHIP.RADIUS + 0.08,
    });
    expect(ring.get(StrokeStyle)).toMatchObject({
      color: 0x00ff00,
      alpha: 1,
      width: 3,
    });
    expect(ring.get(Offset)).toMatchObject({ x: 0, y: 0 });

    parent.set(Shield, { shieldTime: ENTITY_CONFIG.SHIP.SHIELD_DURATION / 2 });
    runFrame(world, 1);
    expect(ring.get(StrokeStyle)).toMatchObject({
      color: rgbToU32(255, 255, 0),
    });

    parent.remove(Shield);
    runFrame(world, 2);
    world.flush();

    expect(world.getEntity(ring.eid)).toBeUndefined();
    expect(parent.get(Embellishments)?.shieldRing).toBeUndefined();
  });

  it('toggles laser beam children from LaserWeapon firing state', () => {
    const world = createTestWorld();
    const parent = createParent(world).set(LaserWeapon, {
      shots: 1,
      firing: false,
      timer: 0,
    });

    runFrame(world);
    expect(parent.get(Embellishments)?.laserBeam).toBeUndefined();

    parent.set(LaserWeapon, { shots: 1, firing: true, timer: 0 });
    runFrame(world, 1);

    const beam = parent.get(Embellishments)!.laserBeam!;
    expect(beam.get(ChildOf)?.target).toBe(parent);
    expect(beam.get(Line)).toMatchObject({ x1: 0, y1: 0, x2: 10.24, y2: 0 });
    expect(beam.get(StrokeStyle)).toMatchObject({
      color: 0xff0000,
      alpha: 1,
      width: 4,
    });
    expect(beam.get(FollowParent)).toBeDefined();
    expect(beam.get(FollowParentRotation)).toBeDefined();
    expect(beam.get(Rotation)).toMatchObject({ angle: Math.PI / 4 });

    parent.set(Rotation, { angle: Math.PI / 2 });
    runFrame(world, 2);
    expect(beam.get(Rotation)).toMatchObject({ angle: Math.PI / 2 });

    parent.set(LaserWeapon, { shots: 1, firing: false, timer: 0 });
    runFrame(world, 3);
    world.flush();

    expect(world.getEntity(beam.eid)).toBeUndefined();
    expect(parent.get(Embellishments)?.laserBeam).toBeUndefined();
  });
});
