import type { Entity } from '@vworlds/vecs';
import {
  Arc,
  Drawable,
  FillStyle,
  FilledRect,
  GameStateView,
  HealthView,
  Position,
  Rotation,
  Shape,
  ShieldView,
  StrokeStyle,
  WeaponView,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  ENTITY_CONFIG,
} from '@spacerocks/common';
import { canvasSize, renderCtx, renderPhase, world } from '../world';
import { getVecsClientWorld } from '../network/vecsClient';

const WEAPON_KIND_LASER = 1;

type CanvasScale = {
  x: number;
  y: number;
};

export function drawNetworkRenderableEntity(
  ctx: CanvasRenderingContext2D,
  entity: Entity,
  scale: CanvasScale,
): void {
  const position = entity.get(Position);
  const drawable = entity.get(Drawable);
  if (!position || !drawable) return;

  ctx.save();
  ctx.translate(position.x * scale.x, position.y * scale.y);
  const rotation = entity.get(Rotation);
  if (rotation) ctx.rotate(rotation.angle);
  ctx.scale(scale.x, scale.y);

  drawLaser(ctx, entity);
  drawShield(ctx, entity);
  applyStyles(ctx, entity);
  drawHealthBar(ctx, entity);
  drawShape(ctx, entity);
  drawArc(ctx, entity);
  drawFilledRect(ctx, entity);
  finishFillAndStroke(ctx, entity);

  ctx.restore();
}

export function renderNetworkWorld(
  ctx: CanvasRenderingContext2D,
  entities: Entity[],
  width: number,
  height: number,
): void {
  const scale = { x: width / WORLD_WIDTH, y: height / WORLD_HEIGHT };
  const sorted = [...entities].sort((a, b) => {
    const aDrawable = a.get(Drawable);
    const bDrawable = b.get(Drawable);
    const zDiff = (aDrawable?.zIndex ?? 0) - (bDrawable?.zIndex ?? 0);
    return zDiff !== 0 ? zDiff : a.eid - b.eid;
  });

  for (const entity of sorted) {
    drawNetworkRenderableEntity(ctx, entity, scale);
  }
}

world
  .system('NetworkRender')
  .phase(renderPhase)
  .run(() => {
    const ctx = renderCtx.ctx;
    const clientWorld = getVecsClientWorld();
    if (!ctx || !clientWorld) return;

    const entities: Entity[] = [];
    clientWorld.filter([Position, Drawable]).forEach((entity: Entity) => {
      if (entity.get(GameStateView)) return;
      entities.push(entity);
    });

    renderNetworkWorld(ctx, entities, canvasSize.width, canvasSize.height);
  });

function drawLaser(ctx: CanvasRenderingContext2D, entity: Entity): void {
  const weapon = entity.get(WeaponView);
  if (
    !weapon ||
    weapon.activeWeapon !== WEAPON_KIND_LASER ||
    weapon.firing === 0
  )
    return;

  ctx.beginPath();
  ctx.strokeStyle = '#ff0000';
  ctx.lineWidth = 4;
  ctx.moveTo(0, 0);
  ctx.lineTo(WORLD_WIDTH, 0);
  ctx.stroke();
}

function drawShield(ctx: CanvasRenderingContext2D, entity: Entity): void {
  const shield = entity.get(ShieldView);
  if (!shield || shield.remainingTime <= 0) return;

  const progress = shield.remainingTime / ENTITY_CONFIG.SHIP.SHIELD_DURATION;
  let r: number;
  let g: number;
  if (progress >= 0.5) {
    const t = (1 - progress) * 2;
    r = Math.floor(255 * t);
    g = 255;
  } else {
    const t = (0.5 - progress) * 2;
    r = 255;
    g = Math.floor(255 * (1 - t));
  }

  ctx.beginPath();
  ctx.strokeStyle = `rgb(${r},${g},0)`;
  ctx.lineWidth = 3;
  ctx.arc(0, 0, ENTITY_CONFIG.SHIP.RADIUS + 8, 0, Math.PI * 2);
  ctx.stroke();
}

function applyStyles(ctx: CanvasRenderingContext2D, entity: Entity): void {
  const fill = entity.get(FillStyle);
  if (fill) ctx.fillStyle = fill.style;

  const stroke = entity.get(StrokeStyle);
  if (stroke) {
    ctx.strokeStyle = stroke.style;
    ctx.lineWidth = stroke.lineWidth;
  }
}

function drawHealthBar(ctx: CanvasRenderingContext2D, entity: Entity): void {
  const health = entity.get(HealthView);
  if (!health || health.barTimer <= 0 || health.maxHp <= 0) return;

  const width = 30;
  const height = 5;
  const x = -width / 2;
  const y = -ENTITY_CONFIG.SHIP.RADIUS - 15;
  const ratio = Math.max(0, Math.min(1, health.hp / health.maxHp));

  ctx.strokeStyle = '#0f0';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, width, height);
  ctx.fillStyle = health.hp <= 33 ? '#f00' : health.hp <= 66 ? '#ff0' : '#0f0';
  ctx.fillRect(x, y, width * ratio, height);
}

function drawShape(ctx: CanvasRenderingContext2D, entity: Entity): void {
  const shape = entity.get(Shape);
  if (!shape) return;

  ctx.beginPath();
  const points = shape.points;
  if (points.length > 0) ctx.moveTo(points[0]!.x, points[0]!.y);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i]!.x, points[i]!.y);
  }
  ctx.closePath();
}

function drawArc(ctx: CanvasRenderingContext2D, entity: Entity): void {
  const arc = entity.get(Arc);
  if (!arc) return;

  ctx.beginPath();
  ctx.arc(0, 0, arc.radius, arc.startAngle, arc.endAngle);
}

function drawFilledRect(ctx: CanvasRenderingContext2D, entity: Entity): void {
  const rect = entity.get(FilledRect);
  if (!rect) return;

  ctx.fillRect(-rect.width / 2, -rect.height / 2, rect.width, rect.height);
}

function finishFillAndStroke(
  ctx: CanvasRenderingContext2D,
  entity: Entity,
): void {
  if (entity.get(FillStyle) && !entity.get(FilledRect)) ctx.fill();
  if (entity.get(StrokeStyle)) ctx.stroke();
}
