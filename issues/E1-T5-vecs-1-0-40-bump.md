# E1-T5 — vecs 1.0.40 bump (when released)

> **Space Rocks — first iteration.** Ticket E1-T5 of Epic 1 (Foundations) from the
> engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`.
> **Hold this ticket until `@vworlds/vecs` 1.0.40 is actually released** (PRs vworlds/vecs#157
> shape casts, vworlds/vecs#158 prismatic/wheel/motor joints — both slated for the release).

## Required reading

1. **Plan** — issue #41 D4 (develop against 1.0.39 until the bump; `overlapCircle` → shape-cast swap sites are marked `TODO(1.0.40)`).
2. **vecs-physics docs** — in the `vworlds/vecs` repo: `lib/vecs-physics/docs/queries.md` (overlap/raycast API), `lib/vecs-physics/docs/joints.md`, `lib/vecs-physics/docs/roadmap.md` (what 1.0.40 adds: shape casts, prismatic/wheel/motor joints).
3. **Code** — root `package.json` (the `@vworlds/vecs` override), `scripts/` (there is a `hot-update:vecs` flow — check root package.json scripts), and every `TODO(1.0.40)` in the tree at the time you pick this up (`grep -rn "TODO(1.0.40)" apps packages`).

## Goal

The monorepo runs on vecs 1.0.40, and the call sites that were written against 1.0.39 stopgaps (`overlapCircle` clearance checks, teleport-lerp snapping) are upgraded to the purpose-built APIs (`shapeCastClosest`/`shapeCastAll`, `MotorJoint`) where marked.

## Dependencies

- vecs 1.0.40 release. Downstream tickets that marked `TODO(1.0.40)`: E2-T6 (arrival nudge), E5-T4 (magnetic snap — MotorJoint evaluation), E8-T2 (tugbot carry). Whichever of those exist when you run this ticket define your swap list — swap only marked sites; leave unmarked `overlapCircle` uses alone.

## What to build

1. Bump the `@vworlds/vecs` version override in root `package.json`; run the `hot-update:vecs` flow per the repo scripts; regenerate the lockfile.
2. Verify the joints demo / existing joint usage still behaves (trains from E4 if landed: `DistanceJoint` chains must not regress).
3. Add a **shape-cast smoke test** under `apps/server/tests/physics`: a swept shape against a known obstacle returns the expected closest hit (this guards the new API's presence and semantics).
4. Sweep `TODO(1.0.40)` sites: replace `overlapCircle` clearance checks with `shapeCastClosest` where marked (E2-T6 arrival nudge); where E5-T4 left a MotorJoint evaluation note, either do the evaluation now (timebox it) or file a follow-up issue — don't silently drop the note.
5. Check `architecture/CHANGELOG.md` in the vecs repo for any breaking changes between 1.0.39 and 1.0.40 and adapt.

## Done when

- Monorepo green on 1.0.40: `npm run typecheck --workspaces`, `npm run test`, and a manual client/server boot.
- Shape-cast smoke test passes.
- No `TODO(1.0.40)` remains unaddressed (swapped, or explicitly deferred with a filed issue linked in the PR).

## Constraints

- This is a dependency bump + marked-site swap, not a refactor pass — resist upgrading unmarked physics code.
- Every commit passes typecheck + tests.
