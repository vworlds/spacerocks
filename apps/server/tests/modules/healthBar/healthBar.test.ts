import { ChildOf, World } from '@vworlds/vecs';
import { DrawBy, Offset, Position } from '@vworlds/vecs-phaser';
import { Networked } from '@vworlds/vecs-server';
import { ENTITY_CONFIG, ProgressBar } from '@spacerocks/common';
import { describe, expect, it, vi } from 'vitest';
import { damagePlayer } from '../../../src/game/modules/combat/module';
import { Health } from '../../../src/game/modules/combat/components';
import { Decay } from '../../../src/game/modules/decay/components';
import { DecayModule } from '../../../src/game/modules/decay/module';
import { HealthBar } from '../../../src/game/modules/healthBar/components';
import { HealthBarModule } from '../../../src/game/modules/healthBar/module';
import { createBaseWorld, DT_MS } from '../helpers';

vi.mock('@vworlds/vecs-server', () => ({
  NetworkClient: class NetworkClient {
    id = '';
  },
  NetworkInput: class NetworkInput {
    input: unknown;
  },
  Networked: class Networked {},
  View: class View {
    dsl: unknown;
  },
}));

function createTestWorld(): World {
  const world = createBaseWorld();
  world.module(DecayModule);
  world.module(HealthBarModule);
  return world;
}

function runFrame(world: World): void {
  world.progress(DT_MS, DT_MS);
}

describe('HealthBarModule', () => {
  it('keeps Health as pure hp data and creates no bar by default', () => {
    const world = createTestWorld();
    const entity = world
      .entity()
      .set(Position, { x: 1, y: 2 })
      .set(Health, { hp: 75, maxHp: 100 });

    runFrame(world);

    expect(entity.get(Health)).toEqual({ hp: 75, maxHp: 100 });
    expect(entity.target(HealthBar)).toBeUndefined();
    expect(entity.has(ProgressBar)).toBe(false);
  });

  it('projects health onto an owned networked display child', () => {
    const world = createTestWorld();
    const entity = world
      .entity()
      .set(Position, { x: 1, y: 2 })
      .set(Health, { hp: 75, maxHp: 100 });
    const target = entity.ensureTarget(HealthBar);

    runFrame(world);

    expect(target.target(ChildOf)).toBe(entity);
    expect(target.has(Networked)).toBe(true);
    expect(target.get(ProgressBar)).toEqual({ value: 75 });
    expect(target.target(DrawBy)).toBe(entity);
    expect(target.get(Offset)).toEqual({ x: 0, y: 0.27 });
    expect(target.has(Position)).toBe(false);
    expect(entity.has(ProgressBar)).toBe(false);

    entity.getMut(Health, (health) => {
      health.hp = 40;
    });
    entity.getMut(Position, (position) => {
      position.x = 3;
      position.y = 4;
    });
    runFrame(world);

    expect(target.get(ProgressBar)).toEqual({ value: 40 });
    expect(target.has(Position)).toBe(false);
  });

  it('removes the projection on query exit and owns the target lifecycle', () => {
    const world = createTestWorld();
    const entity = world
      .entity()
      .set(Position, { x: 1, y: 2 })
      .set(Health, { hp: 50, maxHp: 100 });
    const target = entity.ensureTarget(HealthBar);
    runFrame(world);

    entity.remove(Health);
    runFrame(world);

    expect(entity.target(HealthBar)).toBe(target);
    expect(target.has(ProgressBar)).toBe(false);

    target.destroy();

    expect(entity.target(HealthBar)).toBeUndefined();
    expect(world.getEntity(target.eid)).toBeUndefined();

    const replacement = entity.ensureTarget(HealthBar);
    entity.destroy();

    expect(world.getEntity(replacement.eid)).toBeUndefined();
  });

  it('destroys a temporary bar through Decay and refreshes it on damage', () => {
    const world = createTestWorld();
    const entity = world
      .entity()
      .set(Position, { x: 1, y: 2 })
      .set(Health, { hp: 100, maxHp: 100 });

    world.defer(() => damagePlayer(world, entity));
    const target = entity.target(HealthBar)!;
    expect(target.get(Decay)?.life).toBe(ENTITY_CONFIG.SHIP.HEALTH_BAR_TIMER);

    runFrame(world);
    expect(target.get(Decay)?.life).toBe(
      ENTITY_CONFIG.SHIP.HEALTH_BAR_TIMER - 1,
    );

    world.defer(() => damagePlayer(world, entity));
    expect(target.get(Decay)?.life).toBe(ENTITY_CONFIG.SHIP.HEALTH_BAR_TIMER);
    expect(entity.target(HealthBar)).toBe(target);

    for (
      let frame = 0;
      frame < ENTITY_CONFIG.SHIP.HEALTH_BAR_TIMER;
      frame += 1
    ) {
      runFrame(world);
    }

    expect(entity.target(HealthBar)).toBeUndefined();
    expect(world.getEntity(target.eid)).toBeUndefined();
  });
});
