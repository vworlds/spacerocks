import { ChildOf, PRE_STORE, type Entity } from '@vworlds/vecs';
import { Networked, type ServerWorld } from '@vworlds/vecs-server';
import {
  Alpha,
  Arc,
  FillStyle,
  Line,
  Position as RenderPosition,
  Rectangle,
  Rotation as RenderRotation,
  Size,
  StrokeStyle,
} from '@vworlds/vecs-phaser';
import {
  Alien,
  AsteroidView,
  COLORS,
  ENTITY_CONFIG,
  Health,
  LaserWeapon,
  PlayerShip,
  Shield,
  VIEWPORT_WIDTH,
} from '@spacerocks/common';

const HEALTH_BAR_WIDTH = 0.3;
const HEALTH_BAR_HEIGHT = 0.05;
const HEALTH_BAR_OFFSET = 0.15;
const HEALTH_RED = 0xff0000;
const HEALTH_YELLOW = 0xffff00;
const LASER_WIDTH = 4;
const SHIELD_WIDTH = 3;

export class Offset {
  x = 0;
  y = 0;
}

export class FollowParent {}

export class FollowParentRotation {}

export class Embellishments {
  healthBar: Entity | undefined = undefined;
  healthBarFill: Entity | undefined = undefined;
  shieldRing: Entity | undefined = undefined;
  laserBeam: Entity | undefined = undefined;
}

export function registerEmbellishmentComponents(world: ServerWorld): void {
  world.component(Alien);
  world.component(AsteroidView);
  world.component(PlayerShip);
  world.component(Offset);
  world.component(FollowParent);
  world.component(FollowParentRotation);
  world.component(Embellishments);
}

export function installEmbellishmentSystems(world: ServerWorld): void {
  world
    .system('ServerHealthBarEmbellishments')
    .with(Health)
    .update({ watch: Health, onEnter: true }, (entity, health) => {
      const refs = ensureEmbellishments(entity);
      const radius = getBodyRadius(entity);
      const offsetY = radius + HEALTH_BAR_OFFSET;
      const ratio =
        health.maxHp > 0 ? clamp(health.hp / health.maxHp, 0, 1) : 0;

      refs.healthBar = ensureHealthBarBorder(
        world,
        entity,
        refs.healthBar,
        offsetY,
      );
      refs.healthBarFill = ensureHealthBarFill(
        world,
        entity,
        refs.healthBarFill,
        ratio,
        offsetY,
      );
      entity.modified(Embellishments);

      updateHealthBarBorder(
        refs.healthBar,
        offsetY,
        health.healthBarTimer > 0 && health.maxHp > 0,
      );
      updateHealthBarFill(
        refs.healthBarFill,
        ratio,
        offsetY,
        healthColor(health.hp),
        health.healthBarTimer > 0 && health.maxHp > 0,
      );
    })
    .exit([], (entity) => {
      const refs = entity.getMut(Embellishments);
      refs?.healthBar?.destroy();
      refs?.healthBarFill?.destroy();
      if (refs) {
        refs.healthBar = undefined;
        refs.healthBarFill = undefined;
        entity.modified(Embellishments);
      }
    });

  world
    .system('ServerShieldRingEmbellishments')
    .with(Shield)
    .update({ watch: Shield, onEnter: true }, (entity, shield) => {
      const refs = ensureEmbellishments(entity);
      refs.shieldRing = ensureShieldRing(
        world,
        entity,
        refs.shieldRing,
        shield.shieldTime,
      );
      const stroke = refs.shieldRing.getMut(StrokeStyle);
      if (stroke && stroke.color !== shieldColor(shield.shieldTime)) {
        stroke.color = shieldColor(shield.shieldTime);
        refs.shieldRing.modified(StrokeStyle);
      }
    })
    .exit([], (entity) => {
      const refs = entity.getMut(Embellishments);
      refs?.shieldRing?.destroy();
      if (refs) {
        refs.shieldRing = undefined;
        entity.modified(Embellishments);
      }
    });

  world
    .system('ServerLaserBeamEmbellishments')
    .with(LaserWeapon)
    .update({ watch: LaserWeapon, onEnter: true }, (entity, laser) => {
      const refs = ensureEmbellishments(entity);
      if (laser.firing) {
        refs.laserBeam = ensureLaserBeam(world, entity, refs.laserBeam);
        entity.modified(Embellishments);
        return;
      }

      if (refs.laserBeam) {
        refs.laserBeam.destroy();
        refs.laserBeam = undefined;
        entity.modified(Embellishments);
      }
    })
    .exit([], (entity) => {
      const refs = entity.getMut(Embellishments);
      refs?.laserBeam?.destroy();
      if (refs) {
        refs.laserBeam = undefined;
        entity.modified(Embellishments);
      }
    });

  world
    .system('ApplyEmbellishmentLocalPositions')
    .with(RenderPosition, Offset, FollowParent)
    .cascade(ChildOf)
    .phase(PRE_STORE)
    .each(
      [Offset, RenderPosition, { target: [ChildOf, [RenderPosition]] }],
      (entity, [offset, position, parentPosition]) => {
        if (!parentPosition) return;
        setRenderPosition(
          entity,
          position,
          parentPosition.x + offset.x,
          parentPosition.y + offset.y,
        );
      },
    );

  world
    .system('ApplyEmbellishmentLocalRotations')
    .with(RenderRotation, FollowParent, FollowParentRotation)
    .cascade(ChildOf)
    .phase(PRE_STORE)
    .each(
      [RenderRotation, { target: [ChildOf, [RenderRotation]] }],
      (entity, [rotation, parentRotation]) => {
        if (!parentRotation || rotation.angle === parentRotation.angle) return;
        rotation.angle = parentRotation.angle;
        entity.modified(RenderRotation);
      },
    );
}

function getBodyRadius(entity: Entity): number {
  const asteroidView = entity.get(AsteroidView);
  if (asteroidView) return asteroidView.radius;
  if (entity.get(Alien)) return ENTITY_CONFIG.ALIEN.RADIUS;
  if (entity.get(PlayerShip)) return ENTITY_CONFIG.SHIP.RADIUS;
  return ENTITY_CONFIG.SHIP.RADIUS;
}

function ensureEmbellishments(entity: Entity): Embellishments {
  const existing = entity.get(Embellishments);
  if (existing) return existing;
  const refs = new Embellishments();
  entity.set(Embellishments, refs);
  return refs;
}

function ensureHealthBarBorder(
  world: ServerWorld,
  parent: Entity,
  current: Entity | undefined,
  offsetY: number,
): Entity {
  if (isAlive(world, current)) return current;
  return createChild(world, parent)
    .set(RenderPosition, initialChildPosition(parent, 0, offsetY))
    .add(Rectangle)
    .set(Size, { width: HEALTH_BAR_WIDTH, height: HEALTH_BAR_HEIGHT })
    .set(StrokeStyle, { color: COLORS.healthGreen, alpha: 1, width: 1 })
    .set(Offset, { x: 0, y: offsetY })
    .set(Alpha, { value: 0 });
}

function ensureHealthBarFill(
  world: ServerWorld,
  parent: Entity,
  current: Entity | undefined,
  ratio: number,
  offsetY: number,
): Entity {
  const offsetX = healthFillOffsetX(ratio);
  if (isAlive(world, current)) return current;
  return createChild(world, parent)
    .set(RenderPosition, initialChildPosition(parent, offsetX, offsetY))
    .add(Rectangle)
    .set(Size, { width: ratio * HEALTH_BAR_WIDTH, height: HEALTH_BAR_HEIGHT })
    .set(FillStyle, {
      color: healthColor(parent.get(Health)?.hp ?? 0),
      alpha: 1,
    })
    .set(Offset, { x: offsetX, y: offsetY })
    .set(Alpha, { value: 0 });
}

function updateHealthBarBorder(
  entity: Entity,
  offsetY: number,
  visible: boolean,
): void {
  setOffset(entity, 0, offsetY);
  setAlpha(entity, visible ? 1 : 0);
}

function updateHealthBarFill(
  entity: Entity,
  ratio: number,
  offsetY: number,
  color: number,
  visible: boolean,
): void {
  const size = entity.getMut(Size);
  const width = ratio * HEALTH_BAR_WIDTH;
  if (size && (size.width !== width || size.height !== HEALTH_BAR_HEIGHT)) {
    size.width = width;
    size.height = HEALTH_BAR_HEIGHT;
    entity.modified(Size);
  }

  const fill = entity.getMut(FillStyle);
  if (fill && fill.color !== color) {
    fill.color = color;
    entity.modified(FillStyle);
  }

  setOffset(entity, healthFillOffsetX(ratio), offsetY);
  setAlpha(entity, visible ? 1 : 0);
}

function ensureShieldRing(
  world: ServerWorld,
  parent: Entity,
  current: Entity | undefined,
  shieldTime: number,
): Entity {
  if (isAlive(world, current)) return current;
  return createShieldRing(world, parent, shieldTime);
}

function createShieldRing(
  world: ServerWorld,
  parent: Entity,
  shieldTime: number,
): Entity {
  return createChild(world, parent)
    .set(RenderPosition, initialChildPosition(parent, 0, 0))
    .set(Arc, { radius: ENTITY_CONFIG.SHIP.RADIUS + 0.08 })
    .set(StrokeStyle, {
      color: shieldColor(shieldTime),
      alpha: 1,
      width: SHIELD_WIDTH,
    })
    .set(Offset, { x: 0, y: 0 });
}

function ensureLaserBeam(
  world: ServerWorld,
  parent: Entity,
  current: Entity | undefined,
): Entity {
  if (isAlive(world, current)) return current;
  return createChild(world, parent)
    .set(RenderPosition, initialChildPosition(parent, 0, 0))
    .set(RenderRotation, parent.get(RenderRotation) ?? { angle: 0 })
    .set(Line, { x1: 0, y1: 0, x2: VIEWPORT_WIDTH, y2: 0 })
    .set(StrokeStyle, { color: 0xff0000, alpha: 1, width: LASER_WIDTH })
    .set(Offset, { x: 0, y: 0 })
    .add(FollowParentRotation);
}

function createChild(world: ServerWorld, parent: Entity): Entity {
  return world
    .entity()
    .add(Networked)
    .set(ChildOf, { target: parent })
    .add(FollowParent);
}

function initialChildPosition(
  parent: Entity,
  offsetX: number,
  offsetY: number,
): { x: number; y: number } {
  const parentPosition = parent.get(RenderPosition);
  return {
    x: (parentPosition?.x ?? 0) + offsetX,
    y: (parentPosition?.y ?? 0) + offsetY,
  };
}

function setRenderPosition(
  entity: Entity,
  position: RenderPosition,
  x: number,
  y: number,
): void {
  if (position.x === x && position.y === y) return;
  position.x = x;
  position.y = y;
  entity.modified(RenderPosition);
}

function setOffset(entity: Entity, x: number, y: number): void {
  const offset = entity.getMut(Offset);
  if (!offset || (offset.x === x && offset.y === y)) return;
  offset.x = x;
  offset.y = y;
  entity.modified(Offset);
}

function setAlpha(entity: Entity, value: number): void {
  const alpha = entity.getMut(Alpha);
  if (!alpha || alpha.value === value) return;
  alpha.value = value;
  entity.modified(Alpha);
}

function isAlive(
  world: ServerWorld,
  entity: Entity | undefined,
): entity is Entity {
  return entity !== undefined && world.getEntity(entity.eid) !== undefined;
}

function healthFillOffsetX(ratio: number): number {
  return ((ratio - 1) * HEALTH_BAR_WIDTH) / 2;
}

function healthColor(hp: number): number {
  if (hp <= 33) return HEALTH_RED;
  if (hp <= 66) return HEALTH_YELLOW;
  return COLORS.healthGreen;
}

function shieldColor(shieldTime: number): number {
  const progress = clamp(shieldTime / ENTITY_CONFIG.SHIP.SHIELD_DURATION, 0, 1);
  if (progress >= 0.5) {
    return rgbToU32(Math.floor(255 * (1 - progress) * 2), 255, 0);
  }
  return rgbToU32(255, Math.floor(255 * (1 - (0.5 - progress) * 2)), 0);
}

export function rgbToU32(r: number, g: number, b: number): number {
  return ((clampByte(r) << 16) | (clampByte(g) << 8) | clampByte(b)) >>> 0;
}

function clampByte(value: number): number {
  return clamp(Math.floor(value), 0, 255);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
