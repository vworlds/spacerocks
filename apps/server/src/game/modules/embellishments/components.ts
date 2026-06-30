import { Module, type Entity } from '@vworlds/vecs';

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
  healthBar: Entity | undefined = undefined;
  healthBarFill: Entity | undefined = undefined;
  shieldRing: Entity | undefined = undefined;
  laserBeam: Entity | undefined = undefined;
}

/**
 * Registers the embellishment components: `Offset`, `FollowParent`,
 * `FollowParentRotation`, `Embellishments`.
 */
export class Components extends Module {
  override init(): void {
    this.world.component(Offset);
    this.world.component(FollowParent);
    this.world.component(FollowParentRotation);
    this.world.component(Embellishments);
  }
}
