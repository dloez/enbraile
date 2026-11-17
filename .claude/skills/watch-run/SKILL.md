---
name: watch-run
description: Follow a Zombies run on production (`zombies.enbraile.vip`) from Claude Code in one step — starts the voice worker in the background if it is not running, loads `zombies/site/.env.production.local` without printing it, lists the attempts with their IDs and finds the run, starts `npm run watch` under Monitor, and hands each event to the ee-coach skill's "Watch a run" table. TRIGGER when the user asks to watch, follow or babysit a run or attempt on production, usually naming its ID. SKIP for local runs and for terminal sessions coached here (that is ee-coach alone).
---

# Watch a production run

The ee-coach skill's **Watch a run from Claude Code** owns what to do with each event; load ee-coach first and follow it. This skill only removes the setup.

## The `prod` wrapper

Every site command against production goes through `.claude/skills/watch-run/prod <command>`. It runs the command from `zombies/site/` with `zombies/site/.env.production.local` (untracked; holds `ZOMBIES_URL` and `CLAUDE_TOKEN`) exported, so the token never appears in a command line, a transcript or the terminal. Each Bash call is a fresh shell, so the wrapper goes in front of every command, including the ones subagents run (`compile`, `publish`, `runs`, `say`): tell every subagent to use it. Never `cat`, `echo` or `env` the file or its variables.

If the file is missing, ask the owner to create it with those two variables (the token is in 1Password as "zombies claude token"); never read 1Password yourself into the terminal's output.

## The `voice` helper

`.claude/skills/watch-run/voice` starts the [voice worker](../../../docs/home/voice/how-to/run-the-voice-worker.md) on the owner's PC unless one is running already, detached so it outlives the session, from `home/voice/` with its `.env.local`, logging to the gitignored `home/voice/data/worker.log`. It waits up to 120 s for the worker to connect to the bot and prints one line: already running, started and connected, still starting (a first start downloads models), or exited, with the log's last lines. It never prints the env file. Stop it by hand (`pkill -f "python.* worker.py"`) when the night is over, if the owner asks.

## Steps

1. `.claude/skills/watch-run/voice`, so the coach can hear and speak in the call; say in one line what it printed, and go on even if it failed, since the site works without voice.
2. `.claude/skills/watch-run/prod npm run runs` and print its lines as they are, the attempts with their IDs: each line holds only an attempt's ID, map, language, start, last line, members and counts, never any hint text. Match the run ID the user gave (an attempt ID like `hLzHV-JZ` is the run ID); with none given, name the attempt played most recently and ask which to watch.
3. Start `.claude/skills/watch-run/prod npm run --silent watch -- <id> 2>&1 | .claude/skills/watch-run/filter` under `Monitor` (30-minute maximum; re-arm on each expiry), with a description naming the run. The filter drops the events ee-coach's table says to ignore, every member line among them, so the session wakes only when the live coach replies, holds or is flagged, or the group sends feedback, never because the players talked. Call transcriptions never reach it: the site's machine API does not return them (ee-coach's watch section). The watch's first line, the earlier-events count, still comes through.
4. Go on with ee-coach's watch steps from step 2 (earlier events read once by a subagent, then each event per the table), printing only the table's one-liners.
5. When the night ends, stop the Monitor and run ee-coach's **Debrief** with the wrapper in front of `npm run runs -- <id>`.
