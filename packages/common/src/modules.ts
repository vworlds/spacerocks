import { Module } from '@vworlds/vecs';
import { NETWORK_COMPONENTS } from './network/schema';
import {
  Alien,
  Asteroid,
  AsteroidView,
  AuraWeapon,
  Boomerang,
  BoomerangWeapon,
  Bullet,
  Decay,
  DefaultWeapon,
  GameStateView,
  Health,
  HealthPickup,
  LaserWeapon,
  Pickup,
  PlayerShip,
  Rocket,
  RocketWeapon,
  Shield,
  Wraps,
} from './components';

/**
 * Registers every component defined in `@spacerocks/common`: the network
 * protocol components ({@link NETWORK_COMPONENTS}) plus the server-registered
 * gameplay components. Gameplay modules load this module to ensure the common
 * components they depend on are present instead of registering them
 * themselves.
 */
export class NetworkComponentsModule extends Module {
  override init(): void {
    for (const component of NETWORK_COMPONENTS) {
      this.world.component(component);
    }
    this.world.component(Alien);
    this.world.component(Asteroid);
    this.world.component(AsteroidView);
    this.world.component(AuraWeapon);
    this.world.component(Boomerang);
    this.world.component(BoomerangWeapon);
    this.world.component(Bullet);
    this.world.component(Decay);
    this.world.component(DefaultWeapon);
    this.world.component(GameStateView);
    this.world.component(Health);
    this.world.component(HealthPickup);
    this.world.component(LaserWeapon);
    this.world.component(Pickup);
    this.world.component(PlayerShip);
    this.world.component(Rocket);
    this.world.component(RocketWeapon);
    this.world.component(Shield);
    this.world.component(Wraps);
  }
}

export { NETWORK_COMPONENTS } from './network/schema';
