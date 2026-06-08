import { ON_STORE, ON_UPDATE, World, type ComponentClass } from '@vworlds/vecs';

export type TestWorld = {
  world: World;
  renderPhase: string;
  updatePhase: string;
  tick(now?: number, delta?: number): void;
  tickPhase(phase: string, now?: number, delta?: number): void;
};

export function createTestWorld(
  components: readonly ComponentClass[] = [],
): TestWorld {
  const world = new World();
  for (const Component of components) {
    world.component(Component);
  }
  return {
    world,
    updatePhase: ON_UPDATE,
    renderPhase: ON_STORE,
    tick(now = performance.now(), delta = 16) {
      world.progress(now, delta);
    },
    tickPhase(_phase: string, now = performance.now(), delta = 16) {
      world.progress(now, delta);
    },
  };
}
