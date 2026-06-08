import { PRE_STORE, World } from '@vworlds/vecs';
import { describe, expect, it } from 'vitest';
import { installClientViewSystem } from '../../src/network/clientViews';

class FakeView {
  dsl: unknown = false;
  refreshedDsl: unknown = undefined;
}

describe('server view replication', () => {
  it('configures views before PRE_STORE visibility refresh runs', () => {
    const world = new World();
    world.component(FakeView);

    world
      .system('InternalViewRefresh')
      .phase(PRE_STORE)
      .with(FakeView)
      .update(FakeView, (_entity, view) => {
        view.refreshedDsl = view.dsl;
      });
    installClientViewSystem(world, FakeView);

    const viewEntity = world.entity().add(FakeView);
    world.progress(0, 16);

    const view = viewEntity.get(FakeView);
    expect(view).toMatchObject({ dsl: true, refreshedDsl: true });
  });
});
