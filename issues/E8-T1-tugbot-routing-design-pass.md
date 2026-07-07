# E8-T1 — Tugbot routing design pass

> **Space Rocks — first iteration.** Ticket E8-T1 of Epic 8 (Logistics) from the
> engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`.
> **This is a design ticket, not a code ticket.** Deliverable: a design document (filed as a
> GitHub issue in `vworlds/spacerocks`) that E8-T4/E8-T5 implement against.

## Required reading

1. **Design** — issue #40 §6.9 in full (tugbot behavior: demand-pull; idle priorities — 1 catch floaters, 2 pull-from-stack for demand; after pickup: local demand → deliver, remote demand → hand off toward the demanding zone, no demand → stack with protected-beats-proximity target choice; conflict rules: server-authoritative claims, first wins, re-plan on vanished targets, drop on death, never leave radius; zone chaining A overlap-handoff + B jettison-toward, bidirectional), §16 (open question: "demand-propagation topology, loop prevention, type-tagged demand, dispatch, thrash guards — sketch exists in the issue-10 resolution"), §14.7 (tension: catch-and-release thrash in saturated bases — tuning knob flagged).
2. **The issue-10 resolution sketch** — in the comments of issue vworlds/spacerocks#39 (the council review follow-up sessions). Read the actual comment thread; the design doc must validate against its scenarios.
3. **Plan** — issue #41 Epic 8 intro + risk register ("Tugbot logistics look-alive: design pass ticket before deep code").
4. **Code** — E6-T2 (`Demand` component shape — your propagation rides on it), E8-T3 (stations/zones, if drafted).

## Goal

Close the design's biggest open question before deep implementation: a reviewed algorithm spec for multi-zone demand propagation and tugbot dispatch that E8-T4 (single zone) and E8-T5 (chaining) implement directly.

## Dependencies

- None to start (reading only). Blocks the *deep* parts of E8-T4/T5 (they can scaffold entities meanwhile).

## What to deliver

A design doc covering, concretely enough to implement without further decisions:

1. **Demand propagation topology**: how a station learns of remote demand (per-resource-type aggregation per zone; propagation across overlapping zones; hop limit for loop prevention — the design names it).
2. **Type-tagged demand**: demand entries carry resource type end-to-end; a zone never pulls Crystal for an Ore demand.
3. **Claim protocol**: server-authoritative container claims (first-wins across tugbots AND player pickups), claim release on death/vanish/timeout; demand-slot claims so five tugbots don't feed one demand-1 site.
4. **Dispatch**: which idle tugbot takes which job (priority 1 floaters, 2 stack pulls; nearest-first? oldest-demand-first? — decide), re-plan triggers.
5. **Thrash guards**: the §14.7 saturated-base catch-and-release loop — hysteresis/cooldown knobs (e.g. a container released for "no stacking room" is untouchable for T seconds; a floater caught N times without a home gets deprioritized). Name every knob (they land in config).
6. **Validation against the issue-10 sketch scenarios**: walk each scenario from the #39 comment thread through your algorithm on paper; note divergences and why.
7. Explicit non-goals (first iteration): global optimization, pathfinding beyond seek/avoid, cross-sector logistics (tugbots never cross, §6.9).

## Done when

- The doc is filed as a new GitHub issue titled "Tugbot routing & demand propagation — design (E8-T1)", cross-linked to #40/#41, with every knob named.
- Reviewed: request review from the repo owner (@jpeletier) on the issue; address one round of comments ("reviewed and referenced by E8-T4/T5" is the plan's done-when).
- This PR itself may just update the ticket file/README pointer to the filed issue (the deliverable lives in the issue).

## Constraints

- Stay inside design §6.9's behavior — this pass fills in *how*, it doesn't redesign *what*.
- Every tunable named for config (D8): influence radius interplay, claim timeout, thrash windows, dispatch weights.
