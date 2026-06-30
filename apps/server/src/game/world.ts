import { Module } from '@vworlds/vecs';
import type { AssetManager } from '@vworlds/vecs-phaser-server';
import { NetworkComponentsModule } from '@spacerocks/common';
import { AssetsModule } from './modules/assets/module';
import { RngModule } from './modules/rng/module';
import { GameStateModule } from './modules/gameState/module';
import { SpawningModule } from './modules/spawning/module';
import { PlayerSessionsModule } from './modules/playerSessions/module';
import { InterestGridModule } from './modules/interestGrid/module';
import { MovementModule } from './modules/movement/module';
import { CombatModule } from './modules/combat/module';
import { WeaponsModule } from './modules/weapons/module';
import { DecayModule } from './modules/decay/module';
import { AsteroidsModule } from './modules/asteroids/module';
import { AliensModule } from './modules/aliens/module';
import { PickupsModule } from './modules/pickups/module';
import { EmbellishmentsModule } from './modules/embellishments/module';

export type WorldModuleConfig = {
  manager?: AssetManager;
};

/**
 * Loads every gameplay module in dependency order. Comment out a feature
 * module line and the game runs minus that functionality (cross-module code
 * paths simply never match because no entities carry the absent components).
 *
 * `PhysicsModule` and `PhaserServerModule` are loaded by `index.ts` BEFORE
 * this module (physics must exist before any system spawns bodies;
 * PhaserServerModule's PRE_STORE pose-sync must run before embellishments).
 */
export class WorldModule extends Module<WorldModuleConfig | undefined> {
  override init(config: WorldModuleConfig | undefined): void {
    const world = this.world;

    if (config?.manager) {
      world.module(AssetsModule, { manager: config.manager });
    }

    // Plumbing
    world.module(NetworkComponentsModule);
    world.module(RngModule);
    world.module(GameStateModule);
    world.module(SpawningModule);
    world.module(PlayerSessionsModule);
    world.module(InterestGridModule);

    // Features (depend on plumbing; not on each other)
    world.module(MovementModule);
    world.module(CombatModule);
    world.module(WeaponsModule);
    world.module(DecayModule);
    world.module(AsteroidsModule);
    world.module(AliensModule);
    world.module(PickupsModule);
    world.module(EmbellishmentsModule);
  }
}
