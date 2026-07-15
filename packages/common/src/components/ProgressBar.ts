import { wireType } from '@vworlds/vecs-wire';

/**
 * A generic progress bar rendered client-side. The server sets `value` (an
 * integer 0–100 representing a percentage); the client expands it into local
 * render entities. The first use is the ship health bar (combat sets it from
 * `Health.hp / Health.maxHp`), but any system can attach a `ProgressBar` to
 * show progress — build timers, capture progress, etc.
 *
 * The server controls visibility by adding/removing the component — no bar
 * is drawn when the entity has no `ProgressBar`.
 */
export class ProgressBar {
  @wireType('u8')
  value = 0;
}
