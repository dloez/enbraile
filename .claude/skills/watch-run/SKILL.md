---
name: watch-run
description: Follow a Zombies run on production (`zombies.enbraile.vip`) from Claude Code in one step — loads `zombies/site/.env.production.local` without printing it, finds the run, starts `npm run watch` under Monitor, and hands each event to the ee-coach skill's "Watch a run" table. TRIGGER when the user asks to watch, follow or babysit a run or attempt on production, usually naming its ID. SKIP for local runs and for terminal sessions coached here (that is ee-coach alone).
---

# Watch a production run

The ee-coach skill's **Watch a run from Claude Code** owns what to do with each event; load ee-coach first and follow it. This skill only removes the setup.

## The `prod` wrapper

Every site command against production goes through `.claude/skills/watch-run/prod <command>`. It runs the command from `zombies/site/` with `zombies/site/.env.production.local` (untracked; holds `ZOMBIES_URL` and `CLAUDE_TOKEN`) exported, so the token never appears in a command line, a transcript or the terminal. Each Bash call is a fresh shell, so the wrapper goes in front of every command, including the ones subagents run (`compile`, `publish`, `runs`, `say`): tell every subagent to use it. Never `cat`, `echo` or `env` the file or its variables.

If the file is missing, ask the owner to create it with those two variables (the token is in 1Password as "zombies claude token"); never read 1Password yourself into the terminal's output.

## Steps

1. `.claude/skills/watch-run/prod npm run runs` and match the run ID the user gave (an attempt ID like `hLzHV-JZ` is the run ID). Print only the run's map and member count.
2. Start `.claude/skills/watch-run/prod npm run --silent watch -- <id> 2>&1 | .claude/skills/watch-run/filter` under `Monitor` (30-minute maximum; re-arm on each expiry), with a description naming the run. The filter drops the events ee-coach's table says to ignore and prints one line per 10 member and call lines instead of each one, so the session only wakes for something to act on (owner, 2026-11-16: a turn per call line was noise). The watch's first line, the earlier-events count, still comes through.
3. Go on with ee-coach's watch steps from step 2 (earlier events read once by a subagent, then each event per the table), printing only the table's one-liners.
4. When the night ends, stop the Monitor and run ee-coach's **Debrief** with the wrapper in front of `npm run runs -- <id>`.
