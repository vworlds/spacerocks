# E9-T7 — Captain + recruitment (LAST)

> **Space Rocks — first iteration.** Ticket E9-T7 of Epic 9 (Fleet) from the
> engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`.
> **Explicitly sequenced last and non-blocking**: the loop is provable without captains
> (#41 sequencing; #40 reconciliation note 4). Do not let this ticket block playtests.

## Required reading

1. **Design** — issue #40 §7.5 (captain assembles up to 3 fighters; recruitment gap-fill: a captain with free slots automatically recruits unassigned fighters within a recruitment radius (config); recruited fighters fly formation and inherit its orders; assembly = convoy membership — fighters jump with the captain when ordered across), §7.6 (captain death: fighters keep fighting whatever destroyed it, recruitable later by another captain with a free slot — graceful degradation), §7.2 (Captain: `(0,2,3)`/40s, train 0, default park/patrol; overrides Follow me / Go to beacon — takes fighters).
2. **Plan** — issue #41 Epic 9 intro.
3. **Code** — E9-T1 (framework), E9-T4 (fighter states — formation layers on top), E9-T5 (overrides — captains take the fighter set along), E4-T6/E2-T3 (convoy transfer — fighters as convoy members).

## Goal

The command-compression tier: captains that auto-recruit up to 3 fighters, fly them in formation, carry them through orders and hyperspace jumps, and degrade gracefully on death.

## Dependencies

- **E9-T1, E9-T4, E9-T5, E4-T6** — hard. Everything else in E9/E10 must already be playtestable without this.

## What to build

1. **Captain role**: default park/patrol (park like a fighter (E5-T3 cell) or patrol a small loop near base — config; keep it simple), standard weapons (it fights too — catalog says park, assemble, patrol/defend).
2. **Recruitment**: a captain with free slots (≤3) auto-recruits **unassigned** fighters (no captain, no player-override? — an overridden fighter is under explicit player command; rule: only fighters without an active `Override` and without a captain are recruitable; document) within the recruitment radius (config): a relationship `UnderCaptain { target: captain }` on the fighter (guide §3 — retargetable, queryable, groupBy-able).
3. **Formation**: recruited fighters hold formation offsets around the captain (config slots); their engage reflex stays (they scramble from formation, return to formation when clear — reuse E9-T4's states with a "home = formation slot" variation instead of a parked cell).
4. **Order inheritance**: captain's override applies to its fighters (they follow the captain, who follows the order); a captain ordered across a boundary brings its assembled fighters — **assembly = convoy membership** (E4-T6/E2-T3 convoy enumeration includes `UnderCaptain` members; §7.5/§3.4).
5. **Captain death** (§7.6): fighters drop `UnderCaptain`, keep engaging the captain's attackers (the retaliation reflex seeded with the killer), then normal unassigned default role — recruitable by another captain with slots.
6. Recruiting is captain-initiated only; players command the captain (the compression: tap one entity, command four).

## Done when

- The plan's done-when: captain + 3 fighters patrol together, jump together (Follow-me/Go-to-beacon across a boundary — 4-ship convoy transfer intact), and degrade gracefully when the captain dies (fighters fight on, then get re-recruited by a second captain with free slots — test the full §7.6 path).
- Tests: slot cap (a 4th fighter not recruited); overridden fighters not poached; formation reform after a scramble; convoy includes exactly the assembly.
- `npm run typecheck --workspaces` and `npm run test` pass.

## Constraints

- Recruitment radius, formation offsets, patrol params — config (D8).
- Layer on E9-T4's fighter — don't fork fighter behavior into a captain-specific copy.
- Commander tier deferred (§12) — no hierarchy generalization beyond captain→fighter.
