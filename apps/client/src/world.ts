import { CLIENT_ENTITY_ID_START, createWorld } from '@spacerocks/common';
import { Query } from '@vworlds/vecs';
import {
  Velocity,
  Label,
  Alpha,
  Health,
  Shield,
  LaserWeapon,
  Particle,
  Decay,
  CanvasSize,
  GameStateComp,
  RenderContext,
  Keys,
} from './components/index';
import { initStars } from './utils';

export const world = createWorld({ entityIdStart: CLIENT_ENTITY_ID_START });

// ── Register all components ───────────────────────────────────────────────
world.component(Velocity);
world.component(Label);
world.component(Alpha);
world.component(Health);
world.component(Shield);
world.component(LaserWeapon);
world.component(Particle);
world.component(Decay);
world.component(CanvasSize);
world.component(GameStateComp);
world.component(RenderContext);
world.component(Keys);

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
