# How to Run the Voice Worker

## Prerequisites

- The owner's PC with its NVIDIA GPU, under WSL, with `uv` and `ffmpeg` installed and `nvidia-smi` showing the GPU.
- `home/voice/.env.local` (gitignored) holding `BOT_URL` (the bot's address, `https://dj.<tailnet>.ts.net`, or `http://localhost:8080` for a local bot) and `INTERNAL_SECRET` (the bot's).
- To enable `richtofen`: its bundle (`model.pth`, `config.json`, `vocab.json` and `refs/*.wav`) copied into `home/voice/data/richtofen/`, or `RICHTOFEN_DIR` pointing at it. It is never in git; on the owner's PC it is in `~/voice-lab/models/richtofen/`, and [Remake the Richtofen Voice](remake-the-richtofen-voice.md) makes it again.

## Steps

1. From `home/voice/`: `uv sync`. It installs torch with CUDA 12.8, so the first sync downloads several GB.
2. Choose the voices in `.env.local`: `VOICES`, comma-separated, from `piper`, `chatterbox`, `chatterbox-expressive` and `richtofen` (default `piper`), and `DEFAULT_VOICE` (default the first). Only these load; each costs GPU memory ([measurements](../explanation/voice.md#measurements)).
3. `uv run --env-file .env.local worker.py`. The first start downloads Whisper large-v3 (about 3 GB), the Piper voice if enabled, and the Chatterbox files from Hugging Face if a Chatterbox voice is enabled. It logs each voice engine's load time, then `ready` with the voices and the default, then `connected to` the bot.
4. Leave it running while the group plays. It logs the trigger words the bot sends (`triggers …`), each trigger it hears (`trigger <word> <user id>: <text>`) and each Richtofen try Whisper heard less than 80 % of (`richtofen said …`).

Optional variables: `WHISPER_MODEL` (`large-v3`), `LANGUAGE` (`es`), `PIPER_VOICE` (`es_ES-davefx-medium`), `RICHTOFEN_DIR` (`<DATA_DIR>/richtofen`) and `DATA_DIR` (`home/voice/data`).

## Verification

- The bot's log says `voice worker connected`, then `voices …` with the enabled voices (`kubectl -n dj logs deploy/dj`).
- With a module that registers a trigger word, saying the word in the bot's call logs a `trigger` line on the worker and calls the module.
- A module's `hearing.say` is heard in the call, in the voice it named or the default.
- With transcripts configured, a JSON Lines object appears in the bucket within a minute of talking in the bot's call.
