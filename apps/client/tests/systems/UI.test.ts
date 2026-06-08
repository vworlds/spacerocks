import { describe, it, expect, beforeEach } from 'vitest';
import { GameStateView } from '@spacerocks/common';
import { installUISystem } from '@src/systems/UI';
import { createTestWorld, type TestWorld } from '../helpers/world';

let testWorld: TestWorld;
let scoreEl: HTMLElement;
let waveEl: HTMLElement;
let msgEl: HTMLElement;

beforeEach(() => {
  testWorld = createTestWorld([GameStateView]);
  scoreEl = document.createElement('div');
  waveEl = document.createElement('div');
  msgEl = document.createElement('div');
  installUISystem(testWorld.world, {
    scoreEl,
    waveEl,
    msgEl,
  });
});

function tick() {
  // UI is interval(0.1) – pass enough delta so the system fires.
  testWorld.tickPhase(testWorld.renderPhase, performance.now(), 200);
}

describe('UI', () => {
  it('writes GameStateView score, wave, and status to the DOM', () => {
    testWorld.world.entity().set(GameStateView, {
      score: 900,
      wave: 4,
      state: 0,
      status: 'Game Over',
    });
    tick();
    expect(scoreEl.innerText).toBe('Score: 900');
    expect(waveEl.innerText).toBe('Wave: 4');
    expect(msgEl.innerText).toBe('Game Over');
  });

  it('updates the DOM as GameStateView changes', () => {
    const e = testWorld.world.entity().set(GameStateView, {
      score: 1,
      wave: 1,
      state: 0,
      status: 'go',
    });
    tick();
    expect(scoreEl.innerText).toBe('Score: 1');

    e.set(GameStateView, { score: 250, wave: 3, state: 0, status: '' });
    tick();
    expect(scoreEl.innerText).toBe('Score: 250');
    expect(waveEl.innerText).toBe('Wave: 3');
    expect(msgEl.innerText).toBe('');
  });
});
