# E7-T1 — Shield bubble body + friend/foe matrix

> **Space Rocks — first iteration.** Ticket E7-T1 of Epic 7 (Shields) from the
> engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`.

## Required reading

1. **Design** — issue #40 §6.4, the interaction matrix (asteroids bounce + damage shield; enemy fire absorbed + damage; enemy ships bounce + both damaged; friendly ships pass; friendly fire passes; containers pass), plus: bubbles are additive and independent — each generator projects its own, they don't merge, protected zone is the union; overlapping bubbles: a projectile/asteroid interacts with the **first bubble surface it hits**; "protected" = asteroid-safe only — containers inside are NOT theft-safe or projectile-safe... note enemy fire is absorbed at the surface, so inside-the-bubble containers are de facto safe from outside fire but not from a raider shooting inside (§6.3).
2. **Plan** — issue #41 Epic 7 intro.
3. **vecs-physics docs** — `materials-and-filters.md` (filtering is per-shape and static — friend/foe is per-*relationship*, so filtering alone can't express it; you'll need contact/sensor dispatch + ownership checks in POST_UPDATE, and possibly dynamic filter groups per owner — read `events.md` and decide; document the mechanism), `shapes.md` (circle shapes).
4. **Code** — E6-T1 (generator buildings — the bubble is `ChildOf` its generator), `Owner`, the `CAT_*` bits, `combat/` damage routing.

## Goal

`modules/shields/`: the bubble — a circular damageable child entity of its generator — implementing the six-row friend/foe interaction matrix physically.

## Dependencies

- **E6-T1** (generator building entities exist; the Shield Generator building type registers in E6/E7 wiring), **E1-T2** (radius/HP config). E7-T2 adds HP economics/color; this ticket lands the body + matrix with a plain HP pool.

## What to build

1. Bubble entity: `ChildOf` the generator, own physics body (static circle at the generator's position, radius config), `CAT_SHIELD` category, render: circle stroke (fill none/faint) — color wiring in E7-T2.
2. **The matrix.** Same-`Owner` (and, v1, same-player only — no alliances §12) = friendly:
   - asteroids: solid collision (bounce) + shield damage on impact (impact-scaled or flat — config; POST_UPDATE contact case);
   - enemy bullets: absorbed — destroy bullet, damage shield (bullets shouldn't physically bounce: sensor-style handling or kill-on-contact);
   - enemy ships: solid bounce + damage both (ship takes config ram damage, shield takes config);
   - friendly ships/bullets and **all** containers (any owner, any state): pass through — no contact response.
   The pass-through cases need per-relationship resolution: investigate per-owner collision groups vs. contact-disable via pre-solve (if vecs-physics exposes it) vs. sensor + manual response. Watch for the classic pitfall: a "bounce" you implement via manual impulse will feel mushy — prefer real solid contacts for the bounce rows and disabled contacts for pass rows; document what the engine allows (this is the ticket's hard part — budget for it).
3. Overlapping bubbles: first-surface-hit wins naturally if each bubble is a real body — verify no double-absorption when surfaces coincide (deterministic dispatch order, single consumption per projectile).
4. Bubble lifecycle: exists while the generator says so (E7-T2 drops/restores it; here: spawn with generator, die with generator via `ChildOf`).

## Done when

- **All six matrix rows covered by tests** (the plan's done-when): asteroid bounce+damage; enemy bullet absorbed+damage (bullet gone); enemy ship bounce+both damaged; friendly ship passes; friendly bullet passes; container (FREE/TRAINED, friendly/enemy) passes.
- Overlap test: two bubbles, one projectile → exactly one absorption.
- `npm run typecheck --workspaces` and `npm run test` pass.

## Constraints

- Radius, damage numbers — config (D8). Module pattern (D7); dispatch via POST_UPDATE category cases (§2.3).
- No HUD shield bar — ever (design reconciliation note 3); in-world stroke color only (E7-T2).
