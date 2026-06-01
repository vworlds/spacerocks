import { world, updatePhase, keys } from '../world';
import {
  Position,
  Rotation,
  ShipInput,
  LaserWeapon,
  AuraWeapon,
  RocketWeapon,
  BoomerangWeapon,
  DefaultWeapon,
  StrokeStyle,
} from '../components/index';
import { createBullet } from '../factories/Bullet';
import { createRocket } from '../factories/Rocket';
import { createBoomerang } from '../factories/Boomerang';
import {
  CAT_PLAYER_BULLET,
  CAT_ASTEROID,
  CAT_ENEMY,
  ENTITY_CONFIG,
} from '../constants';

world
  .system('Shooting')
  .requires(Position, ShipInput, Rotation)
  .phase(updatePhase)
  .each([Position, ShipInput, Rotation], (e, [pos, input, rot]) => {
    if (!keys.state[input.shootKey] || input.shootCooldown > 0) return;

    const color = e.get(StrokeStyle)?.style ?? '#fff';
    const aura = e.getMut(AuraWeapon);
    const laser = e.getMut(LaserWeapon);
    const rocketWeapon = e.getMut(RocketWeapon);
    const boomerangWeapon = e.getMut(BoomerangWeapon);

    if (aura && aura.shots > 0) {
      for (let i = 0; i < 8; i++) {
        createBullet(
          pos.x,
          pos.y,
          (i * Math.PI) / 4,
          color,
          'player',
          CAT_PLAYER_BULLET,
          CAT_ASTEROID | CAT_ENEMY,
        );
      }
      aura.shots--;
      if (aura.shots <= 0) {
        e.remove(AuraWeapon);
        e.add(DefaultWeapon);
      }
      input.shootCooldown = ENTITY_CONFIG.SHIP.SHOOT_COOLDOWN;
    } else if (laser && laser.shots > 0) {
      laser.firing = true;
      laser.timer = ENTITY_CONFIG.SHIP.LASER_TIMER;
      laser.shots--;
      input.shootCooldown = ENTITY_CONFIG.SHIP.SHOOT_COOLDOWN;
    } else if (rocketWeapon && rocketWeapon.shots > 0) {
      createRocket(pos.x, pos.y, rot.angle);
      rocketWeapon.shots--;
      if (rocketWeapon.shots <= 0) {
        e.remove(RocketWeapon);
        e.add(DefaultWeapon);
      }
      input.shootCooldown = ENTITY_CONFIG.SHIP.SHOOT_COOLDOWN;
    } else if (boomerangWeapon && boomerangWeapon.shots > 0) {
      createBoomerang(pos.x, pos.y, rot.angle, e);
      boomerangWeapon.shots--;
      input.shootCooldown = ENTITY_CONFIG.SHIP.SHOOT_COOLDOWN;
    } else if (e.get(DefaultWeapon)) {
      createBullet(
        pos.x,
        pos.y,
        rot.angle,
        color,
        'player',
        CAT_PLAYER_BULLET,
        CAT_ASTEROID | CAT_ENEMY,
      );
      input.shootCooldown = ENTITY_CONFIG.SHIP.SHOOT_COOLDOWN;
    }
  });
