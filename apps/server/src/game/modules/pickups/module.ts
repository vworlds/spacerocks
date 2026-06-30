import { ChildOf, POST_UPDATE, Module, type Entity } from '@vworlds/vecs';
import { Position } from '@vworlds/vecs-phaser';
import { SensorEvents } from '@vworlds/vecs-physics';
import {
  AuraWeapon,
  BoomerangWeapon,
  COLORS,
  DefaultWeapon,
  ENTITY_CONFIG,
  GAME_CONFIG,
  Health,
  HealthPickup,
  LaserWeapon,
  Pickup,
  PickupKind,
  PlayerShip,
  RocketWeapon,
  RandomClockKind,
  SCORING,
  Shield,
} from '@spacerocks/common';
import { Components } from './components';
import { createPickup } from './factories';
import { WorldRng } from '../rng/components';
import { createSpawnTimer, SpawnTimer } from '../spawning/components';
import { SpawningModule } from '../spawning/module';
import { addScore, createExplosion, isPlaying } from '../gameState/helpers';

type PickupSpawnSpec = {
  kind: PickupKind;
  clockKind: RandomClockKind;
  min: number;
  max: number;
};

const PICKUP_SPAWNS: PickupSpawnSpec[] = [
  {
    kind: PickupKind.Shield,
    clockKind: RandomClockKind.ShieldPickup,
    min: GAME_CONFIG.SHIELD_SPAWN_MIN_WAIT,
    max: GAME_CONFIG.SHIELD_SPAWN_MAX_WAIT,
  },
  {
    kind: PickupKind.Laser,
    clockKind: RandomClockKind.LaserPickup,
    min: GAME_CONFIG.LASER_SPAWN_MIN_WAIT,
    max: GAME_CONFIG.LASER_SPAWN_MAX_WAIT,
  },
  {
    kind: PickupKind.Aura,
    clockKind: RandomClockKind.AuraPickup,
    min: GAME_CONFIG.AURA_SPAWN_MIN_WAIT,
    max: GAME_CONFIG.AURA_SPAWN_MAX_WAIT,
  },
  {
    kind: PickupKind.Rocket,
    clockKind: RandomClockKind.RocketPickup,
    min: GAME_CONFIG.ROCKET_SPAWN_MIN_WAIT,
    max: GAME_CONFIG.ROCKET_SPAWN_MAX_WAIT,
  },
  {
    kind: PickupKind.Boomerang,
    clockKind: RandomClockKind.BoomerangPickup,
    min: GAME_CONFIG.BOOMERANG_SPAWN_MIN_WAIT,
    max: GAME_CONFIG.BOOMERANG_SPAWN_MAX_WAIT,
  },
  {
    kind: PickupKind.Health,
    clockKind: RandomClockKind.HealthPickup,
    min: GAME_CONFIG.HEALTH_SPAWN_MIN_WAIT,
    max: GAME_CONFIG.HEALTH_SPAWN_MAX_WAIT,
  },
];

function bodyOf(
  world: import('@vworlds/vecs').World,
  shape: Entity | undefined,
): Entity | undefined {
  if (!shape || shape.destroyed) return undefined;
  const body = shape.target(ChildOf);
  if (!body || body.destroyed || !world.getEntity(body.eid)) return undefined;
  return body;
}

function setActiveWeapon(player: Entity, kind: PickupKind): void {
  if (player.get(LaserWeapon)) player.remove(LaserWeapon);
  if (player.get(AuraWeapon)) player.remove(AuraWeapon);
  if (player.get(RocketWeapon)) player.remove(RocketWeapon);
  if (player.get(BoomerangWeapon)) player.remove(BoomerangWeapon);
  if (player.get(DefaultWeapon)) player.remove(DefaultWeapon);

  if (kind === PickupKind.Laser) {
    player.set(LaserWeapon, {
      shots: ENTITY_CONFIG.SHIP.LASER_SHOT_COUNT,
      firing: false,
      timer: 0,
    });
  } else if (kind === PickupKind.Aura) {
    player.set(AuraWeapon, { shots: ENTITY_CONFIG.SHIP.AURA_SHOT_COUNT });
  } else if (kind === PickupKind.Rocket) {
    player.set(RocketWeapon, { shots: ENTITY_CONFIG.ROCKET.SHOT_COUNT });
  } else if (kind === PickupKind.Boomerang) {
    player.set(BoomerangWeapon, {
      shots: ENTITY_CONFIG.BOOMERANG.MAX_SHOTS,
      inFlight: 0,
    });
  }
}

function applyPickupEffect(
  world: import('@vworlds/vecs').World,
  player: Entity,
  pickupEntity: Entity,
): void {
  const pickup = pickupEntity.get(Pickup);
  if (!pickup) return;

  if (pickup.kind === PickupKind.Shield) {
    player.set(Shield, { shieldTime: ENTITY_CONFIG.SHIP.SHIELD_DURATION });
    addScore(world, SCORING.SHIELD);
  } else if (pickup.kind === PickupKind.Laser) {
    setActiveWeapon(player, PickupKind.Laser);
    addScore(world, SCORING.LASER);
  } else if (pickup.kind === PickupKind.Aura) {
    setActiveWeapon(player, PickupKind.Aura);
    addScore(world, SCORING.AURA);
  } else if (pickup.kind === PickupKind.Rocket) {
    setActiveWeapon(player, PickupKind.Rocket);
    addScore(world, SCORING.ROCKET);
  } else if (pickup.kind === PickupKind.Boomerang) {
    setActiveWeapon(player, PickupKind.Boomerang);
    addScore(world, SCORING.BOOMERANG);
  } else {
    const healthPickup = pickupEntity.get(HealthPickup);
    const health = player.getMut(Health);
    if (health && healthPickup) {
      health.hp = Math.min(
        health.hp + health.maxHp * healthPickup.amount,
        health.maxHp,
      );
      health.healthBarTimer = ENTITY_CONFIG.SHIP.HEALTH_BAR_TIMER;
      player.modified(Health);
      addScore(
        world,
        healthPickup.amount <= 0.25
          ? SCORING.HEALTH_SMALL
          : SCORING.HEALTH_LARGE,
      );
    }
  }
}

/**
 * Pickup lifecycle: periodic spawning of each pickup kind (shield, laser,
 * aura, rocket, boomerang, health) via `SpawnTimer`s, and pickup collection
 * (`PickupCollect`) — a player touching a pickup applies its effect (weapon
 * swap, shield, heal) and destroys the pickup.
 *
 * Dependencies: `RngModule`, `SpawningModule` (`SpawnTimer`),
 * `GameStateModule` (`isPlaying`, `createExplosion`, `addScore`).
 */
export class PickupsModule extends Module {
  override init(): void {
    const world = this.world;
    const rng = world.get(WorldRng)?.prng;
    if (!rng) {
      throw new Error('PickupsModule requires RngModule to be loaded first');
    }
    this.world.module(Components);
    this.world.module(SpawningModule);

    const now = Date.now();
    for (const { clockKind, min, max } of PICKUP_SPAWNS) {
      createSpawnTimer(world, rng, now, clockKind, min, max);
    }

    world
      .system('ServerPickupClockSystem')
      .interval(0.5)
      .with(SpawnTimer)
      .each([SpawnTimer], (_entity, [timer]) => {
        if (!isPlaying(world)) return;
        if (timer.kind === RandomClockKind.Alien) return;
        const now = Date.now();
        if (now < timer.nextTick) return;

        const match = PICKUP_SPAWNS.find((p) => p.clockKind === timer.kind);
        if (match) createPickup(world, rng, match.kind);
        timer.nextTick = now + rng.range(timer.minWait, timer.maxWait);
      });

    const pickupProcessed = new Set<number>();

    world
      .system('ResetPickupCollectFrame')
      .phase(POST_UPDATE)
      .run(() => pickupProcessed.clear());

    world
      .system('PickupCollect')
      .with({ parent: Pickup })
      .phase(POST_UPDATE)
      .update(SensorEvents, (shape, events) => {
        if (!isPlaying(world)) return;
        if (pickupProcessed.has(shape.eid)) return;
        pickupProcessed.add(shape.eid);
        const self = bodyOf(world, shape);
        if (!self || self.destroyed) return;

        for (const event of events.begin) {
          const other = bodyOf(world, event.other);
          if (!other || other === self || other.destroyed) continue;

          if (other.get(PlayerShip)) {
            applyPickupEffect(world, other, self);
            const pos = other.get(Position);
            if (pos) createExplosion(world, pos.x, pos.y, COLORS.white, 0.2);
            self.destroy();
            break;
          }
        }
      });
  }
}
