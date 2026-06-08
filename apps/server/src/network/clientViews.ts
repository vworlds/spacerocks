import { ON_LOAD, type ComponentClass, type World } from '@vworlds/vecs';

type ClientView = {
  dsl: unknown;
};

export function installClientViewSystem<TView extends ClientView>(
  world: World,
  ViewComponent: ComponentClass<TView>,
): void {
  world
    .system('SetClientView')
    .phase(ON_LOAD)
    .with(ViewComponent)
    .enter([ViewComponent], (entity, [view]) => {
      view.dsl = true;
      entity.modified(ViewComponent);
    });
}
