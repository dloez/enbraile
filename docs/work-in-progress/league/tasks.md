# The League Tasks

Not yet scoped ([discovery.md](discovery.md)). The scoping entry comes first; the questions below it are part of what it settles, team locking first by the owner's priority. The idea waits until the site v2 rework is done (owner, 2026-10-23).

## Scope the league

Run `/scope league` on this idea: read the Trainer League app and series 1's league rules first, then interview the owner through every anchor area, and turn this dir into a full discovery and a queue of vertical slices. The two questions below are settled in that interview, team locking first.

**Do:**
- [ ] Read the Trainer League app (`https://raspi.tail3e36c9.ts.net:10000/`), [Series 1 Rules](../../pkmn/series/1/reference/rules.md) and version 43 of the Site v2 Screens canvas.
- [ ] Interview the owner; rewrite `discovery.md` and this file as the `/scope` skill lays them out.

**Acceptance:**
- Claude-run: none (no code).
- Human-run: the owner answers the interview and reads the resulting queue.
- Reuse: [discovery.md](discovery.md)'s What Is Known.
- Neighbors: [site-v2](../site-v2/discovery.md).
- Forbidden: product decisions made without the owner.

**Touches:** `docs/work-in-progress/league/`, `docs/work-in-progress/index.md`
**Needs the author:** the whole interview; started only once site v2's rework is done.

## Decide how a team is locked

[Site v2 → Team Building](../site-v2/discovery.md#team-building) says only that a tournament creates teams whose sources it locks, and the Trainer League app hides a matchday's pairings until a trainer locks in that matchday's team. Open: who locks a team and when (a matchday, a cup round, an admin, the player submitting it); what locking freezes, the sources only or the whole build (members, items, abilities, moves); whether it can be unlocked, and by whom; how a locked team shows on the team page and the team list. Higher priority than the entry below, which depends on it. _(owner, 2026-10-23)_

**Do:**
- [ ] Settle it in the scoping interview and record it in `discovery.md`.

**Acceptance:**
- Claude-run: none (no code).
- Human-run: the owner answers.
- Reuse: none.
- Neighbors: none.
- Forbidden: none.

**Touches:** `docs/work-in-progress/league/`
**After:** Scope the league
**Needs the author:** the questions above.

## Decide what happens to the items a locked team uses in a manual series

A locked team's build spends items (Mini Setas on abilities, held items), and the player has to spend them in the real game too; the site only learns what the save holds at the next upload. Open: whether the site deducts them from the snapshot's bag for the player's other teams once a team is locked; whether it expects the next snapshot to show them spent; what happens when it does not, keeping to the trust stance of manual series, with no blocking validation ([Site v2 → Snapshots In](../site-v2/discovery.md#snapshots-in)). _(owner, 2026-10-23)_

**Do:**
- [ ] Settle it in the scoping interview and record it in `discovery.md`.

**Acceptance:**
- Claude-run: none (no code).
- Human-run: the owner answers.
- Reuse: none.
- Neighbors: none.
- Forbidden: none.

**Touches:** `docs/work-in-progress/league/`
**After:** Decide how a team is locked
**Needs the author:** the questions above.
