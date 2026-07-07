# E11-T2 — Bot player harness

> **Space Rocks — first iteration.** Ticket E11-T2 of Epic 11 (Playtest harness, soak & balance)
> from the engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`.

## Required reading

1. **Plan** — issue #41 Epic 11 intro ("headless client driving intents (mine/haul/build script) for soak and 2-player automation of experiments 9–10"); E10-T4 (the scenarios that want bot drivers).
2. **Code** — `apps/client/src/network/vecsClient.ts` + `apps/client/tests/network` (how a client connects and sends intents — the bot is this minus Phaser), the intent protocol (E4-T1/E2-T4 extensions), `apps/server/tests/network` (existing network test patterns — the bot may live near them).

## Goal

A headless bot client: connects like a real player, perceives through the replicated world state, and drives scripted intent sequences — the engine for soaks and automated 2-player experiments.

## Dependencies

- The intent surface (E4-T1, E2-T4) and a playable loop (E1–E8 for the mine/haul/build script) — hard for the full script; the harness skeleton (connect, replicate, send intents) can land earlier and grow scripts.

## What to build

1. **Harness**: a Node-runnable bot (`apps/server/tests`-adjacent or a new `apps/bot`/`packages` location — pick with repo layout in mind; it must not drag Phaser/DOM deps) that: connects to a world URL as a session, maintains the replicated component view (reuse the client's network layer sans render), sends the full intent surface (thrust/rotate/fire/grab/jettison/rotate-train/hyperdrive/beacon/tap-RPC).
2. **Behavior scripting**: composable primitives (`flyTo`, `shootAt`, `grabNearest`, `jettisonAt`, `orderProduction`) + scripted sequences; a **mine/haul/build script**: find rock → mine → collect → haul to base → deliver → order/place a building — enough to exercise the loop.
3. **Soak runner**: N bots on preset X for T minutes; **leak assertions**: entity counts and listener counts flat over time (sample and compare windows — "no crash, no leak" is the done-when), memory watermark logged.
4. **2-player scenario support**: two bots with distinct sessions for E10-T4's experiments (raider/defender roles scriptable).
5. CI wiring: a **nightly** soak job (2 bots, 2×1, 30 min — the plan's spec) separate from the per-commit suite (extend `ci/`); artifacts: logs + the leak metrics.

## Done when

- The plan's done-when: nightly soak — 2 bots, 2×1 lattice, 30 minutes, **no crash, no leak** (entity/listener counts flat) — runs green.
- A smoke variant (short duration) runs in the normal test suite.
- Bot API documented for E10-T4/E11-T3 consumers.
- `npm run typecheck --workspaces` and `npm run test` pass.

## Constraints

- The bot uses the public protocol only (no server-side backdoors) — it must exercise the real wire path.
- Server-only packages must not leak into any client-shipped bundle via shared bot code (workspace hygiene).
