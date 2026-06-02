import { World, type ComponentClass, type IPhase } from '@vworlds/vecs';

export type TestWorld = {
  world: World;
  renderPhase: IPhase;
  updatePhase: IPhase;
  tick(now?: number, delta?: number): void;
  tickPhase(phase: IPhase, now?: number, delta?: number): void;
};

export function createTestWorld(
  components: readonly ComponentClass[] = [],
): TestWorld {
  const world = new World();
  for (const Component of components) {
    world.component(Component);
  }
  const updatePhase = world.addPhase('update');
  const renderPhase = world.addPhase('render');
  return {
    world,
    updatePhase,
    renderPhase,
    tick(now = performance.now(), delta = 16) {
      world.progress(now, delta);
    },
    tickPhase(phase: IPhase, now = performance.now(), delta = 16) {
      world.beginFrame(delta);
      world.runPhase(phase, now, delta);
      world.endFrame();
    },
  };
}
