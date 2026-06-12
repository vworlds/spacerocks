import type { Entity } from '@vworlds/vecs';
import { Networked, type ServerWorld } from '@vworlds/vecs-server';
import { Depth, Position, Text, TextAlign } from '@vworlds/vecs-phaser';
import { GameStateView, WORLD_MAX_Y, WORLD_MIN_X } from '@spacerocks/common';

const HUD_DEPTH = 1000;
const HUD_FONT_SIZE = 18;
const HUD_COLOR = 0xffffff;

export class HudRefs {
  score: Entity | undefined = undefined;
  wave: Entity | undefined = undefined;
  message: Entity | undefined = undefined;
}

export function registerHudComponents(world: ServerWorld): void {
  world.component(HudRefs);
}

export function installHudSystems(world: ServerWorld): void {
  world
    .system('ServerHudCreate')
    .with(GameStateView)
    .enter([GameStateView], (entity, [state]) => {
      const refs = ensureHudRefs(entity);
      refs.score = createHudText(world, {
        x: WORLD_MIN_X + 1.0,
        y: WORLD_MAX_Y - 0.25,
        value: `Score: ${state.score}`,
        fontFamily: 'monospace',
        fontSize: HUD_FONT_SIZE,
        align: TextAlign.Left,
      });
      refs.wave = createHudText(world, {
        x: WORLD_MIN_X + 1.0,
        y: WORLD_MAX_Y - 0.55,
        value: `Wave: ${state.wave}`,
        fontFamily: 'monospace',
        fontSize: HUD_FONT_SIZE,
        align: TextAlign.Left,
      });
      refs.message = createHudText(world, {
        x: 0,
        y: 0,
        value: state.status,
        fontFamily: 'sans-serif',
        fontSize: 28,
        align: TextAlign.Center,
      });
      entity.modified(HudRefs);
    })
    .exit([], (entity) => {
      const refs = entity.getMut(HudRefs);
      refs?.score?.destroy();
      refs?.wave?.destroy();
      refs?.message?.destroy();
    });

  world
    .system('ServerHudSync')
    .with(GameStateView, HudRefs)
    .update(GameStateView, (entity, state) => {
      const refs = entity.get(HudRefs);
      if (!refs) return;
      setTextValue(refs.score, `Score: ${state.score}`);
      setTextValue(refs.wave, `Wave: ${state.wave}`);
      setTextValue(refs.message, state.status);
    });
}

function ensureHudRefs(entity: Entity): HudRefs {
  let refs = entity.getMut(HudRefs);
  if (!refs) {
    refs = new HudRefs();
    entity.set(HudRefs, refs);
  }
  return refs;
}

function createHudText(
  world: ServerWorld,
  options: {
    x: number;
    y: number;
    value: string;
    fontFamily: string;
    fontSize: number;
    align: TextAlign;
  },
): Entity {
  return world
    .entity()
    .add(Networked)
    .set(Position, { x: options.x, y: options.y })
    .set(Text, {
      value: options.value,
      fontFamily: options.fontFamily,
      fontSize: options.fontSize,
      color: HUD_COLOR,
      align: options.align,
    })
    .set(Depth, { value: HUD_DEPTH });
}

function setTextValue(entity: Entity | undefined, value: string): void {
  const text = entity?.getMut(Text);
  if (!entity || !text || text.value === value) return;
  text.value = value;
  entity.modified(Text);
}
