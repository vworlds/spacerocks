import { ChildOf, type Entity } from '@vworlds/vecs';
import { PlayerShip } from '../playerShips/components';
import { PlayerInputIntent, PlayerSession } from './components';

export function getOwnedShip(clientEntity: Entity): Entity | undefined {
  for (const session of clientEntity.children(ChildOf)) {
    if (!session.get(PlayerSession)) continue;

    for (const ship of session.children(ChildOf)) {
      if (ship.get(PlayerShip)) return ship;
    }
  }

  return undefined;
}

export function parseInputIntent(input: unknown): PlayerInputIntent {
  const intent = new PlayerInputIntent();
  if (typeof input !== 'object' || input === null) return intent;

  const record = input as Partial<Record<keyof PlayerInputIntent, unknown>>;
  intent.thrust = record.thrust === true;
  intent.rotateLeft = record.rotateLeft === true;
  intent.rotateRight = record.rotateRight === true;
  intent.shoot = record.shoot === true;
  return intent;
}
