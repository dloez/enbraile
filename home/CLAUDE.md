# home

@../docs/home/index.md

Adds to the root `CLAUDE.md`; never repeats it. This category's docs live in `docs/home/`, never under `home/`.

- **Gate:** `npm run gate` in `home/bot/` (it checks every module too); `uv run python -m py_compile worker.py` in `home/voice/`. Then check a change by running it: the assistant only by talking to it in a voice channel.
- **Versions:** every package is pinned exactly.
- **Worker changes:** after changing anything in `home/voice/`, run `.claude/skills/watch-run/voice`, which restarts the running worker when its code or settings changed.
