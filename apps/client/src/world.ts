import { CLIENT_ENTITY_ID_START, createWorld } from '@spacerocks/common';
import { Query } from '@vworlds/vecs';
import {
  Velocity,
  AngularVelocity,
  Friction,
  Thrust,
  Label,
  Alpha,
  Collider,
  Health,
  Shield,
  LaserWeapon,
  AuraWeapon,
  RocketWeapon,
  BoomerangWeapon,
  Boomerang,
  DefaultWeapon,
  Pickup,
  HealthPickup,
  Player,
  ShipInput,
  Bullet,
  Rocket,
  Asteroid,
  Alien,
  Particle,
  Decay,
  Wraps,
  CanvasSize,
  GameStateComp,
  RenderContext,
  Keys,
  RandomClock,
} from './components/index';
import { initStars } from './utils';

export const world = createWorld({ entityIdStart: CLIENT_ENTITY_ID_START });

// ── Register all components ───────────────────────────────────────────────
world.component(Velocity);
world.component(AngularVelocity);
world.component(Friction);
world.component(Thrust);
world.component(Label);
world.component(Alpha);
world.component(Collider);
world.component(Health);
world.component(Shield);
world.component(LaserWeapon);
world.component(AuraWeapon);
world.component(RocketWeapon);
world.component(BoomerangWeapon);
world.component(Boomerang);
world.component(DefaultWeapon);
world.component(Pickup);
world.component(HealthPickup);
world.component(Player);
world.component(ShipInput);
world.component(Bullet);
world.component(Rocket);
world.component(Asteroid);
world.component(Alien);
world.component(Particle);
world.component(Decay);
world.component(Wraps);
world.component(CanvasSize);
world.component(GameStateComp);
world.component(RenderContext);
world.component(Keys);
world.component(RandomClock);

// Weapons are mutually exclusive
world.setExclusiveComponents(
  LaserWeapon,
  AuraWeapon,
  RocketWeapon,
  BoomerangWeapon,
  DefaultWeapon,
);

// ── Singleton resource entity ─────────────────────────────────────────────
export const resourceEntity = world
  .entity()
  .add(CanvasSize)
  .add(GameStateComp)
  .add(RenderContext)
  .add(Keys);
export const canvasSize = resourceEntity.get(CanvasSize)! as CanvasSize;
export const gameState = resourceEntity.get(GameStateComp)! as GameStateComp;
export const renderCtx = resourceEntity.get(RenderContext)! as RenderContext;
export const keys = resourceEntity.get(Keys)! as Keys;

world.clearAllEntities = () => {
  for (const entity of world.entities.values()) {
    if (
      entity.eid < CLIENT_ENTITY_ID_START ||
      entity === resourceEntity ||
      entity.get(Query)
    )
      continue;
    entity.destroy();
  }
  world.flush();
};

// ── Phases ────────────────────────────────────────────────────────────────
export const updatePhase = world.addPhase('update');
export const renderPhase = world.addPhase('render');

// ── DOM refs (set before world.start()) ──────────────────────────────────
export let scoreEl: HTMLElement;
export let waveEl: HTMLElement;
export let msgEl: HTMLElement;
export let canvas: HTMLCanvasElement;

export function initDOM(
  canvasEl: HTMLCanvasElement,
  score: HTMLElement,
  wave: HTMLElement,
  msg: HTMLElement,
): void {
  canvas = canvasEl;
  scoreEl = score;
  waveEl = wave;
  msgEl = msg;

  canvasSize.width = canvasEl.width = window.innerWidth;
  canvasSize.height = canvasEl.height = window.innerHeight;

  const ctx = canvasEl.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D canvas context');
  renderCtx.ctx = ctx;
  renderCtx.stars = initStars(canvasSize.width, canvasSize.height);

  window.addEventListener('keydown', (e) => {
    keys.state[e.code] = true;
  });
  window.addEventListener('keyup', (e) => {
    keys.state[e.code] = false;
  });
  window.addEventListener('resize', () => {
    canvasSize.width = canvasEl.width = window.innerWidth;
    canvasSize.height = canvasEl.height = window.innerHeight;
    renderCtx.stars = initStars(canvasSize.width, canvasSize.height);
  });
}
