# How to Run the Voice Worker

## Prerequisites

- The owner's PC with its NVIDIA GPU, under WSL, with `uv` and `ffmpeg` installed and `nvidia-smi` showing the GPU.
- `home/voice/.env.local` (gitignored) holding `BOT_URL` (the bot's address, `https://dj.<tailnet>.ts.net`, or `http://localhost:8080` for a local bot) and `INTERNAL_SECRET` (the bot's).

## Steps

1. From `home/voice/`: `uv sync`.
2. `uv run --env-file .env.local worker.py`. The first start downloads Whisper large-v3 (about 3 GB) and the Piper voice. It logs `ready` with the load time, then `connected to` the bot.
3. Leave it running while the group plays. Each request it hears is logged as `wake <user id>: <request>`.

Optional variables: `WAKE_WORD` (default `bebe`, compared without accents), `WHISPER_MODEL` (`large-v3`), `LANGUAGE` (`es`), `VOICE` (`es_ES-davefx-medium`) and `DATA_DIR` (`home/voice/data`).

## Verification

- The bot's log says `voice worker connected` (`kubectl -n dj logs deploy/dj`).
- In a voice channel, `/bebe` brings the bot in. Saying «bebé, ¿qué suena?» plays a chime at once and a spoken answer a few seconds later.
