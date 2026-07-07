# E3-T6 — Weapon/container interaction guard

> **Space Rocks — first iteration.** Ticket E3-T6 of Epic 3 (Mining) from the
> engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`.

## Required reading

1. **Design** — issue #40 §4.3 (weapons cannot destroy containers in the first iteration — prevents popping an enemy's train instead of fighting the ship; only asteroid impacts destroy containers; demolition weapon deferred), §5.1 (FREE containers may be destroyed by asteroid impact; TRAINED loss → §5.3 mid-train re-joint).
2. **Plan** — issue #41 Epic 3 intro.
3. **vecs-physics docs** — `lib/vecs-physics/docs/materials-and-filters.md` (mask bits), `events.md` (ContactEvents).
4. **Code** — `apps/server/src/game/modules/weapons/` (bullet categories/masks), `containers` module (E3-T3), the `CAT_*` bits.

## Goal

Two hard rules enforced in physics filtering + collision dispatch: bullets pass through containers entirely; asteroid impacts destroy containers.

## Dependencies

- **E3-T3** (containers exist) — hard. Coordinate with **E4-T4** (mid-train loss handling reacts to container destruction — your destruction event is their trigger).

## What to build

1. **Bullets × containers: no interaction.** Set mask bits so bullet shapes and container shapes never collide/contact (cheapest and matches "pass through"; §4.3). Verify shield interactions planned in E7 aren't broken by the mask choice — keep the container mask table documented next to the `CAT_*` bits.
2. **Asteroid × container: destroy.** POST_UPDATE contact case (category-pair dispatch per design §2.3): on asteroid–container contact (impact above a small config threshold if a grace is needed to avoid destroying freshly-chipped containers resting on their source rock — tune; the chip drift from E3-T3 should usually clear it), destroy the container. Applies to FREE and TRAINED alike (§5.1/§5.3); emit/reuse a destruction path that E4-T4's chain re-joint can observe (destroying the entity is the event — E4-T4 watches its train links).
3. Consider the freshly-chipped case explicitly: a container spawning in contact with its parent rock must survive long enough to drift clear (spawn offset from E3-T3, impact threshold, or a short spawn-grace tag — pick one, test it).

## Done when

- Test: bullet fired through a container passes through (no contact, container lives, bullet lives).
- Test: asteroid impact destroys a FREE container.
- Test: freshly chipped container survives its own birth next to the rock.
- `npm run typecheck --workspaces` and `npm run test` pass.

## Constraints

- Filtering via `CollisionFilter` masks where possible; dispatch via POST_UPDATE category cases for the destructive verb (design §2.3).
- Thresholds/grace in config (D8).
