# E9-T5 — Ship order radial menu + overrides

> **Space Rocks — first iteration.** Ticket E9-T5 of Epic 9 (Fleet) from the
> engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`. Closes **Experiment 7** (#40 §13.7).

## Required reading

1. **Design** — issue #40 §7.4 in full (overrides via tap → radial → order; persist until explicitly revoked — no auto-expiry; an override's defined behavior includes its **full logistics loop** — a "Mine near beacon" miner in a foreign sector crosses out, mines, hauls home **across boundaries**, returns, repeats until revoked; revoke → default role **in the current sector** — no fly-home; stranded ships keep operating; overrides authorize boundary crossing §3.4; "Follow me" escorts jump with the player on **every** hyperspace until dismissed), §7.2 (per-type override sets), §10.3 (orders are given via ships, not the beacon; the beacon need not be visible at order time).
2. **Plan** — issue #41 Epic 9 intro + D3 (crossings via the E2-T3 transfer).
3. **Code** — E6-T10 (the tap/radial/RPC surface — ship orders are its second config), E9-T1 (`Override {kind, beaconRef}`), E9-T6 (beacon — the referenced point; coordinate landing order), E2-T3/T4 (transfer + the `mayCross` authorization hook), E4-T6 (convoy enumeration for escorts).

## Goal

The command half of the fleet: tap an own ship → per-type orders; overrides persist, authorize sector crossings (including the full cross-sector logistics loop), and revoke cleanly to in-place defaults.

## Dependencies

- **E6-T10**, **E9-T1..T4**, **E2-T3/T4**, **E9-T6** (beacon orders need it — Follow-me works without) — hard. Captain convoy behavior is E9-T7's; keep "takes fighters" out of scope here.

## What to build

1. **Menu config** (E6-T10's second radial config): per ship type — Fighter/Captain: Follow me, Go to beacon, Dismiss; Miner: Mine near beacon, Dismiss; Tug: Haul from beacon, Dismiss (catalog §7.2). Server validates ownership + type-legality (E6-T10's RPC handler dispatch point).
2. **Override semantics** (E9-T1's `Override` component): set on order (replacing any previous); **persist until Dismiss** — no auto-expiry, no danger heuristics (§7.4); Dismiss → remove override → default role resumes **in the current sector** (state reset per role; a fighter dismissed abroad parks on whatever planetoid exists or hovers if none — catalog note).
3. **Follow me**: the ship escorts the player (formation offset, config); on player hyperspace, escorts are **convoy members** (E4-T6's enumeration): they jump with the player every time until dismissed.
4. **Beacon orders**: "Go to beacon" (fly there, then type-default behavior at the location: fighter engages/parks); "Mine near beacon" (the E9-T2 loop relocated: cross to the beacon's sector if needed — override = crossing authorization via E2-T4's `mayCross` — mine there, **haul home across boundaries** to the home base, return; repeat until revoked); "Haul from beacon" (E9-T3's sweep relocated: haul from the beacon area to... home base — the design says the loop is the override's definition; document the reading: sweep at beacon → deliver home). Beacon moved → standing orders re-target (§7.4 "keeps cycling until revoked or the beacon moves").
5. **Stranded ships**: player leaves/dies → ships continue last override/default where they are (no cleanup on player death; only Dismiss or ship death ends an override) (§7.4).
6. NPC crossing via E2-T3 transfer: role/override state on the transfer whitelist (coordinate with E2-T3's extensible whitelist).

## Done when

- **Experiment 7** (the plan's done-when): tap fighter → Follow me → responsive escort; player jumps → escort arrives too (10/10 with E4-T6's harness); Dismiss abroad → parks there.
- **Cross-sector mine-near-beacon soak**: beacon in a neighbor sector → miner crosses, mines, hauls home, returns — ≥3 full cycles unattended (sim test).
- Tests: override persistence (no expiry over long sim); revoke-in-place; ownership rejection; beacon-move re-target; override state survives transfer.
- `npm run typecheck --workspaces` and `npm run test` pass.

## Constraints

- Orders only via tapped-ship radial — no beacon menu, no remote ordering (§10.3/§7.4; the radio layer is deferred §12).
- Formation offsets, approach radii — config (D8). One transfer helper (D3).
