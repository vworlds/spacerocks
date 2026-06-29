import { ChildOf, Module } from '@vworlds/vecs';
import { NetworkClient, NetworkInput } from '@vworlds/vecs-server';
import {
  PlayerInputIntent,
  PlayerSession,
  registerPlayerSessionComponents,
} from './components';
import {
  createPlayerShip,
  getOwnedShip,
  parseInputIntent,
} from './shipFactory';

/**
 * Owns player session lifecycle: creates a `PlayerSession` + player ship when
 * a `NetworkClient` connects, and translates each client's `NetworkInput`
 * into the ship's `PlayerInputIntent` (read by movement/shooting systems).
 *
 * Depends on `AssetsModule` (the ship factory calls `pickShipSprite`, which
 * reads the `WorldAssets` singleton); load it first.
 */
export class PlayerSessionsModule extends Module {
  override init(): void {
    registerPlayerSessionComponents(this.world);

    let nextPlayerIndex = 0;

    this.world
      .system('CreatePlayerSession')
      .with(NetworkClient)
      .enter([NetworkClient], (clientEntity, [client]) => {
        const playerIndex = nextPlayerIndex++;
        console.info(
          `[srv] CreatePlayerSession enter client=${client.id} index=${playerIndex}`,
        );
        const session = this.world
          .entity()
          .set(PlayerSession, { clientId: client.id, playerIndex })
          .set(ChildOf, { target: clientEntity });

        createPlayerShip(this.world, session, playerIndex, client.id);
      })
      .exit([NetworkClient], (_clientEntity, [client]) => {
        console.info(`[srv] CreatePlayerSession exit client=${client.id}`);
      });

    this.world
      .system('ApplyNetworkInputToOwnedShip')
      .with(NetworkClient, NetworkInput)
      .each([NetworkInput], (clientEntity, [networkInput]) => {
        const ship = getOwnedShip(clientEntity);
        if (!ship) return;

        const intent = ship.getMut(PlayerInputIntent);
        if (!intent) return;

        const input = parseInputIntent(networkInput.input);
        intent.thrust = input.thrust;
        intent.rotateLeft = input.rotateLeft;
        intent.rotateRight = input.rotateRight;
        intent.shoot = input.shoot;
      });
  }
}
