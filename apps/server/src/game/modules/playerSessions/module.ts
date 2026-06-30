import { ChildOf, Module } from '@vworlds/vecs';
import { NetworkClient, NetworkInput } from '@vworlds/vecs-server';
import { createPlayerShip } from '../playerShips/factories';
import { PlayerShipsModule } from '../playerShips/module';
import { Components, PlayerInputIntent, PlayerSession } from './components';
import { getOwnedShip, parseInputIntent } from './factories';

/**
 * Owns player session lifecycle: creates a `PlayerSession` + player ship when
 * a `NetworkClient` connects, and translates each client's `NetworkInput`
 * into the ship's `PlayerInputIntent` (read by movement/shooting systems).
 *
 * Depends on `PlayerShipsModule` to create the owned ship archetype when a
 * network client connects.
 */
export class PlayerSessionsModule extends Module {
  override init(): void {
    this.world.module(PlayerShipsModule);
    this.world.module(Components);

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
