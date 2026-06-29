import { type World } from '@vworlds/vecs';

/**
 * Local offset (meters) of a child embellishment from its parent's render
 * position. The `ApplyEmbellishmentLocalPositions` system adds this to the
 * parent's position each PRE_STORE.
 */
export class Offset {
  x = 0;
  y = 0;
}

/** Marks a child to follow its parent's render position. */
export class FollowParent {}

/** Marks a child to follow its parent's render rotation. */
export class FollowParentRotation {}

/**
 * Per-entity embellishment refs (health bar, shield ring, laser beam). Stored
 * on the body entity so the embellishment systems can update/destroy the child
 * entities reactively as Health/Shield/LaserWeapon change.
 */
export class Embellishments {
  healthBar: import('@vworlds/vecs').Entity | undefined = undefined;
  healthBarFill: import('@vworlds/vecs').Entity | undefined = undefined;
  shieldRing: import('@vworlds/vecs').Entity | undefined = undefined;
  laserBeam: import('@vworlds/vecs').Entity | undefined = undefined;
}

export function registerEmbellishmentComponents(world: World): void {
  world.component(Offset);
  world.component(FollowParent);
  world.component(FollowParentRotation);
  world.component(Embellishments);
}
