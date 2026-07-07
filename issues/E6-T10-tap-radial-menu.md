# E6-T10 — Tap + radial menu (client + protocol)

> **Space Rocks — first iteration.** Ticket E6-T10 of Epic 6 (Buildings, construction & production)
> from the engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`.
> These are the game's **only two abstract UI elements** (#40 §10.4) — get them right.

## Required reading

1. **Design** — issue #40 §10.4 (exactly two abstract UI elements, both "slow": building production radial menu, ship order radial menu; no menus for fast actions), §6.7 (radial menu: tap building → produce which seed/ship/tugbot, toggle production), §7.4 (tap a ship visible in the viewport → order — the *orders* are E9-T5's; you land the surface), §10.1 (tap interactions live in the slow zone).
2. **Plan** — issue #41 Epic 6 intro ("client tap/click hit-test on replicated entities → radial menu UI (Phaser graphics) → RPC to server (vecs-protocol RPC channel) → validate ownership server-side → set production order / ship override; one shared radial component, two configs").
3. **Code** — `apps/client/src/main.ts` (input/scene), the vecs-protocol RPC channel (check `@vworlds/vecs-protocol` docs/exports in the `vworlds/vecs` repo, `lib/vecs-protocol/`, and how `vecsClient.ts` could carry an RPC), E6-T5 (`ProductionOrder`), `Owner`.

## Goal

Tap/click an entity you own → a radial menu of its actions → an RPC the server validates and applies. One shared radial component; two configs (building production now, ship orders as E9-T5's plug-in point).

## Dependencies

- **E6-T5/T6/T9** (orders to set) — hard. **E9-T5** plugs ship orders into your surface — design the config for it (menu entries = data: label, icon/char, RPC payload).

## What to build

1. **Client hit-test**: pointer tap → pick the topmost replicated entity within a config radius (world-space; use the replicated render components' bounds); only entities with menu-relevant components (buildings with production entries; ships later). Keep it forgiving on mobile (radius knob).
2. **Radial menu UI** (Phaser graphics): entries laid out radially around the tapped entity; tap-outside/ESC dismisses; one instance at a time; screen-space rendering that tracks the entity. Entries come from a per-entity-kind config table (building type → its recipes; ship type → its orders, E9-T5). Keep the component generic — "one shared radial, two configs" is the plan's letter.
3. **RPC**: a request channel client→server (vecs-protocol RPC per plan; if the current transport lacks a ready RPC path, the fallback is an intent-style networked request component — but investigate the protocol channel first and justify the choice in the PR): payload `{ entityId, action, arg }`.
4. **Server validation**: session owns the target (`Owner` match) — reject otherwise (silently or with a nak; log in dev); entity alive and in the session's world; action valid for the entity type. Then apply: set/toggle `ProductionOrder` (buildings). Ship overrides route to E9-T5's handler when it lands (leave the dispatch point).
5. HUD/UX: menu opening is a "slow" interaction — it must not fire fast-zone actions (don't shoot when tapping a building; suppress fire for taps that hit a menu-relevant entity, or require a distinct input — document the choice and test it on both control schemes, §2.6 phone-playable).

## Done when

- Manual + test: tap own Main → radial shows seed/tugbot entries → order Factory seed → seed pops out (the plan's done-when: end-to-end through RPC → `ProductionOrder` → E6-T5 → ejection).
- Test: unauthorized tap (enemy building) rejected **server-side** (client-side hiding is not the security boundary).
- Test: RPC validation — dead entity, wrong world, bogus action.
- `npm run typecheck --workspaces` and `npm run test` pass.

## Constraints

- Exactly two menu configs; no other abstract UI (§10.4). No new fast-zone UI.
- Menu geometry/radius knobs in client constants; entries data-driven (D8).
- Server-authoritative: the client proposes, the server validates (ownership, liveness, legality).
