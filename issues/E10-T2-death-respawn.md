# E10-T2 — Death → 5s → respawn at Main

> **Space Rocks — first iteration.** Ticket E10-T2 of Epic 10 (Combat, death & elimination)
> from the engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`. Includes **Experiment 6's** respawn micro-test.

## Required reading

1. **Design** — issue #40 §11.1 (on death: cargo train floats FREE where death happened; a 5-second death timer (config) runs; respawn at the main building in a fresh all-rounder; no kits, no cost, no interaction — the only verb while dead is wait; the fleet keeps operating; respawn reveals nothing to other players §3.5), §7.1 (the all-rounder is produced only by respawn at the Main).
2. **Plan** — issue #41 Epic 10 intro ("replace the current `RespawnTimer` flow; respawn **in the home sector world** — cross-world respawn via E2 transfer of the session's view: client gets `SectorTransfer` home; fleet unaffected"), D2.
3. **Code** — the current respawn flow (grep `RespawnTimer` / respawn in `playerShips`/`gameState`), E4-T5 (cargo drop on death), E2-T4/T5 (`SectorTransfer` + client switch), E6-T6 (Main as spawn anchor), `playerSessions/`.

## Goal

Death anywhere → 5 wall-clock seconds of nothing → a fresh all-rounder at the player's Main in their home sector, with the client transparently switched home — leaking nothing to other players.

## Dependencies

- **E10-T1** (dying), **E4-T5** (cargo drop), **E2-T4/T5** (cross-world client move), **E6-T6** (Main) — hard.

## What to build

1. Replace the legacy respawn flow: on player death — cargo drops (E4-T5, already reactive), explosion, ship entity gone; the **session** enters a dead state with `respawnAt = now + 5` (wall-clock, config; §8.2 discipline). Client-side: a minimal death state (dim/`respawning...`; no interaction — the design wants *wait*, and the game does it for you).
2. **Respawn**: timer elapsed → spawn a fresh all-rounder at the player's Main (spawn point adjacent/above the Main — clear-position check, reuse E2-T6's clearance) **in the home sector world**; if the player died in a foreign sector, move the session's view home: the same `SectorTransfer` signal → E2-T5's client switch (dying player's client swaps worlds during the death screen — latency hidden by the timer).
3. Grab default ON, empty train, full health — a fresh §7.1 all-rounder.
4. **Fleet unaffected**: overrides/default roles continue everywhere (verify nothing in session death touches fleet entities — §11.1 "the payoff for building autonomy").
5. **No location leak** (§3.5): respawn must emit nothing new to *other* clients (they never see the home sector unless they're in it; verify no global broadcast — e.g. don't network the death/respawn state beyond the owner).
6. Elimination interplay (E10-T3): if the Main is destroyed while dead, elimination cancels the pending respawn (same-tick rule: elimination wins). Leave the cancellation hook explicit for E10-T3.

## Done when

- The plan's done-when: die in a foreign sector → respawn at home Main 5s later; client world-switch smooth (manual on 2×1); no location leak (two-client test: killer's client receives nothing tied to the victim's home sector).
- Tests: cargo dropped at death location (foreign sector included); 5s wall-clock honored; fleet keeps running through owner death (sim: miner loop uninterrupted); respawn position clear-checked; fresh-ship state correct.
- **Experiment 6 micro-test** (die → 5s → respawn at main) recorded with E9-T4's experiment run.
- `npm run typecheck --workspaces` and `npm run test` pass.

## Constraints

- Death timer config (D8); wall-clock seconds (§8.2).
- Respawn is the ONLY all-rounder source (§7.1); no cost, no kits (reconciliation note 5).
