import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { world, updatePhase, gameState } from '@src/world';
import {
  BIT_PLAYER,
  BIT_ASTEROID,
  BIT_PLAYER_BULLET,
  BIT_ENEMY_BULLET,
  BIT_ENEMY,
  BIT_PICKUP,
  BIT_BOOMERANG,
  registerCollisionEffect,
  setInitGameCallback,
} from '@src/systems/Collision';
import {
  Position,
  Collider,
  Health,
  Shield,
  Asteroid,
  Alien,
  Player,
  Bullet,
  Pickup,
  PickupKind,
  Boomerang,
  BoomerangWeapon,
} from '@src/components';
import {
  CAT_PLAYER,
  CAT_ASTEROID,
  CAT_PLAYER_BULLET,
  CAT_ENEMY_BULLET,
  CAT_ENEMY,
  CAT_PICKUP,
  CAT_BOOMERANG,
  SCORING,
  ENTITY_CONFIG,
  SHIELD_DAMAGE,
} from '@src/constants';

beforeAll(() => world.start());
afterEach(() => {
  world.clearAllEntities();
  gameState.score = 0;
  gameState.state = 'playing';
  setInitGameCallback(() => {});
  vi.useRealTimers();
});

function tick() {
  world.beginFrame(16);
  world.runPhase(updatePhase, Date.now(), 16);
  world.endFrame();
}

// Place two entities on top of each other so they collide.
function place(x = 0, y = 0) {
  return { x, y };
}

describe('Collision – BIT constants', () => {
  it('exports correct bit index values', () => {
    expect(BIT_PLAYER).toBe(0);
    expect(BIT_ASTEROID).toBe(1);
    expect(BIT_PLAYER_BULLET).toBe(2);
    expect(BIT_ENEMY_BULLET).toBe(3);
    expect(BIT_ENEMY).toBe(4);
    expect(BIT_PICKUP).toBe(5);
    expect(BIT_BOOMERANG).toBe(6);
  });
});

describe('Collision – system skips when not playing', () => {
  it('does not fire collision effects when state is lose', () => {
    gameState.state = 'lose';
    let called = false;
    const a = world.entity().set(Position, place()).set(Collider, {
      radius: 10,
      category: CAT_PLAYER_BULLET,
      mask: CAT_ASTEROID,
    });
    world
      .entity()
      .set(Position, place())
      .set(Collider, {
        radius: 10,
        category: CAT_ASTEROID,
        mask: CAT_PLAYER_BULLET,
      })
      .set(Asteroid, { level: 1, color: '#aaa' });
    a.events.on('destroy', () => {
      called = true;
    });
    tick();
    expect(called).toBe(false);
  });
});

describe('Collision – player bullet vs asteroid', () => {
  it('destroys both bullet and asteroid on overlap', () => {
    const bullet = world
      .entity()
      .set(Position, place())
      .set(Collider, {
        radius: 5,
        category: CAT_PLAYER_BULLET,
        mask: CAT_ASTEROID,
      })
      .set(Bullet, { ownerType: 'player' });
    const asteroid = world
      .entity()
      .set(Position, place())
      .set(Collider, {
        radius: 20,
        category: CAT_ASTEROID,
        mask: CAT_PLAYER_BULLET,
      })
      .set(Asteroid, { level: 1, color: '#aaa' });
    let bulletDead = false;
    let rockDead = false;
    bullet.events.on('destroy', () => {
      bulletDead = true;
    });
    asteroid.events.on('destroy', () => {
      rockDead = true;
    });
    tick();
    expect(bulletDead).toBe(true);
    expect(rockDead).toBe(true);
  });

  it('adds score for destroyed asteroid', () => {
    world
      .entity()
      .set(Position, place())
      .set(Collider, {
        radius: 5,
        category: CAT_PLAYER_BULLET,
        mask: CAT_ASTEROID,
      })
      .set(Bullet, { ownerType: 'player' });
    world
      .entity()
      .set(Position, place())
      .set(Collider, {
        radius: 20,
        category: CAT_ASTEROID,
        mask: CAT_PLAYER_BULLET,
      })
      .set(Asteroid, { level: 3, color: '#aaa' });
    tick();
    expect(gameState.score).toBe(SCORING.ASTEROID_BASE * 3);
  });

  it('does not collide when entities do not overlap', () => {
    const bullet = world
      .entity()
      .set(Position, { x: 0, y: 0 })
      .set(Collider, {
        radius: 2,
        category: CAT_PLAYER_BULLET,
        mask: CAT_ASTEROID,
      })
      .set(Bullet, { ownerType: 'player' });
    world
      .entity()
      .set(Position, { x: 500, y: 500 })
      .set(Collider, {
        radius: 20,
        category: CAT_ASTEROID,
        mask: CAT_PLAYER_BULLET,
      })
      .set(Asteroid, { level: 1, color: '#aaa' });
    let dead = false;
    bullet.events.on('destroy', () => {
      dead = true;
    });
    tick();
    expect(dead).toBe(false);
  });
});

describe('Collision – player bullet vs alien', () => {
  it('damages alien health', () => {
    world
      .entity()
      .set(Position, place())
      .set(Collider, {
        radius: 5,
        category: CAT_PLAYER_BULLET,
        mask: CAT_ENEMY,
      })
      .set(Bullet, { ownerType: 'player' });
    const alien = world
      .entity()
      .set(Position, place())
      .set(Collider, {
        radius: 15,
        category: CAT_ENEMY,
        mask: CAT_PLAYER_BULLET,
      })
      .set(Alien, { shootCooldown: 0 })
      .set(Health, { hp: 50, maxHp: 50, healthBarTimer: 0 });
    tick();
    const hp = alien.get(Health)!.hp;
    expect(hp).toBe(50 - ENTITY_CONFIG.BULLET.DAMAGE);
  });

  it('destroys alien when hp drops to 0 or below', () => {
    world
      .entity()
      .set(Position, place())
      .set(Collider, {
        radius: 5,
        category: CAT_PLAYER_BULLET,
        mask: CAT_ENEMY,
      })
      .set(Bullet, { ownerType: 'player' });
    let dead = false;
    const alien = world
      .entity()
      .set(Position, place())
      .set(Collider, {
        radius: 15,
        category: CAT_ENEMY,
        mask: CAT_PLAYER_BULLET,
      })
      .set(Alien, { shootCooldown: 0 })
      .set(Health, {
        hp: ENTITY_CONFIG.BULLET.DAMAGE,
        maxHp: 50,
        healthBarTimer: 0,
      });
    alien.events.on('destroy', () => {
      dead = true;
    });
    tick();
    expect(dead).toBe(true);
    expect(gameState.score).toBe(SCORING.ALIEN);
  });
});

describe('Collision – enemy bullet vs player', () => {
  it('damages player health when no shield', () => {
    const bullet = world
      .entity()
      .set(Position, place())
      .set(Collider, {
        radius: 5,
        category: CAT_ENEMY_BULLET,
        mask: CAT_PLAYER,
      })
      .set(Bullet, { ownerType: 'alien' });
    const player = world
      .entity()
      .set(Position, place())
      .set(Collider, {
        radius: 12,
        category: CAT_PLAYER,
        mask: CAT_ENEMY_BULLET,
      })
      .set(Player, { playerId: 0 })
      .set(Health, { hp: 100, maxHp: 100, healthBarTimer: 0 });
    let bulletDead = false;
    bullet.events.on('destroy', () => {
      bulletDead = true;
    });
    tick();
    expect(player.get(Health)!.hp).toBe(90);
    expect(bulletDead).toBe(true);
  });

  it('damages shield time instead of hp when shield is active', () => {
    world
      .entity()
      .set(Position, place())
      .set(Collider, {
        radius: 5,
        category: CAT_ENEMY_BULLET,
        mask: CAT_PLAYER,
      })
      .set(Bullet, { ownerType: 'alien' });
    const player = world
      .entity()
      .set(Position, place())
      .set(Collider, {
        radius: 12,
        category: CAT_PLAYER,
        mask: CAT_ENEMY_BULLET,
      })
      .set(Player, { playerId: 0 })
      .set(Health, { hp: 100, maxHp: 100, healthBarTimer: 0 })
      .set(Shield, { shieldTime: 2400 });
    tick();
    // hp unchanged, shield reduced
    expect(player.get(Health)!.hp).toBe(100);
    const shieldTime = player.get(Shield)?.shieldTime;
    expect(shieldTime).toBe(2400 - SHIELD_DAMAGE.BULLET);
  });

  it('schedules one reset when multiple lethal collisions happen in one tick', () => {
    vi.useFakeTimers();
    const initGame = vi.fn();
    setInitGameCallback(initGame);

    for (let i = 0; i < 2; i++) {
      world
        .entity()
        .set(Position, place())
        .set(Collider, {
          radius: 5,
          category: CAT_ENEMY_BULLET,
          mask: CAT_PLAYER,
        })
        .set(Bullet, { ownerType: 'alien' });
    }

    world
      .entity()
      .set(Position, place())
      .set(Collider, {
        radius: 12,
        category: CAT_PLAYER,
        mask: CAT_ENEMY_BULLET,
      })
      .set(Player, { playerId: 0 })
      .set(Health, { hp: 10, maxHp: 100, healthBarTimer: 0 });

    tick();
    expect(gameState.state).toBe('lose');

    vi.advanceTimersByTime(3000);
    expect(initGame).toHaveBeenCalledTimes(1);
  });
});

describe('Collision – player vs pickup', () => {
  it('applies pickup kind effect and destroys pickup', () => {
    const player = world
      .entity()
      .set(Position, place())
      .set(Collider, { radius: 12, category: CAT_PLAYER, mask: CAT_PICKUP })
      .set(Player, { playerId: 0 });
    let pickupDead = false;
    const pickup = world
      .entity()
      .set(Position, place())
      .set(Collider, { radius: 15, category: CAT_PICKUP, mask: CAT_PLAYER })
      .set(Pickup, { kind: PickupKind.Shield });
    pickup.events.on('destroy', () => {
      pickupDead = true;
    });
    tick();
    expect(player.get(Shield)).toBeDefined();
    expect(pickupDead).toBe(true);
  });
});

describe('Collision – boomerang vs asteroid', () => {
  it('destroys both boomerang and asteroid', () => {
    const boom = world
      .entity()
      .set(Position, place())
      .set(Collider, { radius: 7, category: CAT_BOOMERANG, mask: CAT_ASTEROID })
      .set(Boomerang, { ownerId: null, armed: true });
    const asteroid = world
      .entity()
      .set(Position, place())
      .set(Collider, {
        radius: 20,
        category: CAT_ASTEROID,
        mask: CAT_BOOMERANG,
      })
      .set(Asteroid, { level: 1, color: '#aaa' });
    let boomDead = false;
    let rockDead = false;
    boom.events.on('destroy', () => {
      boomDead = true;
    });
    asteroid.events.on('destroy', () => {
      rockDead = true;
    });
    tick();
    expect(boomDead).toBe(true);
    expect(rockDead).toBe(true);
  });
});

describe('Collision – player catches boomerang', () => {
  it('destroys boomerang and increments weapon shots when armed and owner matches', () => {
    const player = world
      .entity()
      .set(Position, place())
      .set(Collider, { radius: 12, category: CAT_PLAYER, mask: CAT_BOOMERANG })
      .set(Player, { playerId: 0 })
      .set(BoomerangWeapon, { shots: 2, inFlight: 1 });
    let boomDead = false;
    const boom = world
      .entity()
      .set(Position, place())
      .set(Collider, { radius: 7, category: CAT_BOOMERANG, mask: CAT_PLAYER })
      .set(Boomerang, { ownerId: player.eid, armed: true });
    boom.events.on('destroy', () => {
      boomDead = true;
    });
    tick();
    expect(boomDead).toBe(true);
    expect(player.get(BoomerangWeapon)!.shots).toBe(3);
  });

  it('does not catch boomerang when not armed', () => {
    const player = world
      .entity()
      .set(Position, place())
      .set(Collider, { radius: 12, category: CAT_PLAYER, mask: CAT_BOOMERANG })
      .set(Player, { playerId: 0 })
      .set(BoomerangWeapon, { shots: 2, inFlight: 1 });
    let boomDead = false;
    const boom = world
      .entity()
      .set(Position, place())
      .set(Collider, { radius: 7, category: CAT_BOOMERANG, mask: CAT_PLAYER })
      .set(Boomerang, { ownerId: player.eid, armed: false });
    boom.events.on('destroy', () => {
      boomDead = true;
    });
    tick();
    expect(boomDead).toBe(false);
  });
});

describe('Collision – registerCollisionEffect', () => {
  it('allows registering custom collision handlers', () => {
    let fired = false;
    // Use custom bits that won't conflict with existing handlers
    const BIT_A = 10;
    const BIT_B = 11;
    const CAT_A = 1 << BIT_A;
    const CAT_B = 1 << BIT_B;
    registerCollisionEffect(BIT_A, BIT_B, () => {
      fired = true;
    });
    world
      .entity()
      .set(Position, place())
      .set(Collider, { radius: 10, category: CAT_A, mask: CAT_B });
    world
      .entity()
      .set(Position, place())
      .set(Collider, { radius: 10, category: CAT_B, mask: CAT_A });
    tick();
    expect(fired).toBe(true);
  });
});
