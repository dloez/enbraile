# How to Run the Voice Worker

## Prerequisites

- The owner's PC with its NVIDIA GPU, under WSL, with `uv` and `ffmpeg` installed and `nvidia-smi` showing the GPU.
- `home/voice/.env.local` (gitignored) holding `BOT_URL` (the bot's address, `https://dj.<tailnet>.ts.net`, or `http://localhost:8080` for a local bot) and `INTERNAL_SECRET` (the bot's).
- To enable `richtofen`: its bundle (CosyVoice3's `cosyvoice3.yaml`, `config.json`, `configuration.json`, `hift.pt`, `campplus.onnx`, `speech_tokenizer_v3.onnx`, `flow.decoder.estimator.fp32.onnx` and `CosyVoice-BlankEN/`, the fine-tuned `llm.pt` and `flow.pt`, and `ref.wav` with its words in `ref.txt`) in `home/voice/data/richtofen-cosyvoice/`, or `RICHTOFEN_DIR` pointing at it. It is never in git; [Remake the Richtofen Voice](remake-the-richtofen-voice.md) makes it again. Its first load also needs `git` and GitHub, to clone CosyVoice's code into `data/cosyvoice/`.

## Steps

1. From `home/voice/`: `uv sync`. It installs torch with CUDA 12.8, so the first sync downloads several GB.
2. Choose the voices in `.env.local`: `VOICES`, the ones modules may ask for, comma-separated, from `piper`, `chatterbox`, `chatterbox-expressive` and `richtofen` (default `piper`); `DEFAULT_VOICE` (default the first); and `WARM_VOICES`, the ones loaded from the start and kept (default the default voice; `WARM_VOICES=` for none). The others load only while a module holds them; each loaded voice costs GPU memory ([measurements](../explanation/voice.md#measurements)).
3. `uv run --env-file .env.local worker.py`. The first start downloads Whisper large-v3 (about 3 GB), the Piper voice if enabled, and the Chatterbox files from Hugging Face if a Chatterbox voice is enabled. It logs each warm voice engine's load time, then `ready` with the voices, the default and the loaded ones, then `connected to` the bot.
4. Leave it running while the group plays. For a Zombies night, the `watch-run` skill's `.claude/skills/watch-run/voice` does step 3 itself when no worker is running, and restarts a running worker whose `worker.py`, `pyproject.toml`, `uv.lock` or `.env.local` changed since it started: detached, so it outlives the session, logging to `home/voice/data/worker.log`, and it waits for `connected to`. It logs the trigger words the bot sends (`triggers …`), the voices modules hold (`wanted voices …`), each engine it loads or unloads (`… loaded in`, `… unloaded`, `… failed to load: …`), each trigger it hears (`trigger <word> <user id>: <text>`), each whole `say` (`spoke <audio>s of audio in <s>`, or `spoke from the cache`), the prepared lines (`prepared <voice>: …`), each `say` spoken in another voice than asked (`voice <name> … speaking with <voice>`) or that failed (`say in <name> failed: …`) and each streamed reply's timing (`streamed in …, first audio after …`).

Optional variables: `LOAD_WAIT_S` (`30`, how long a `say` waits for its voice to load), `WHISPER_MODEL` (`large-v3`), `LANGUAGE` (`es`), `PIPER_VOICE` (`es_ES-davefx-medium`), `RICHTOFEN_DIR` (`<DATA_DIR>/richtofen-cosyvoice`), `RICHTOFEN_HOP` (`16`, speech tokens in Richtofen's first chunk of each sentence; smaller starts sooner but stutters, [measurements](../explanation/voice.md#measurements)), `RICHTOFEN_STEPS` (`5`, his decoder's steps) and `DATA_DIR` (`home/voice/data`).

## Verification

- The bot's log says `voice worker connected`, then `voices …` with the voices modules may ask for and the loaded ones (`kubectl -n dj logs deploy/dj`).
- A module that holds a voice makes the worker log `wanted voices …` and `… loaded in`; `nvidia-smi` shows the memory go up, and down again after `… unloaded` once no module holds it.
- With a module that registers a trigger word, saying the word in the bot's call logs a `trigger` line on the worker and calls the module.
- A module's `hearing.say` is heard in the call, in the voice it named or the default.
- With transcripts configured, a JSON Lines object appears in the bucket within a minute of talking in the bot's call.

## Measure the voice

`bench.py` times Richtofen on five fixed sentences and prints how long they took to make against how long they play, the GPU's mean use, and with `--whisper` how many transcriptions ran beside it. Run it from `home/voice/`, at the menu and mid-match, to see what the game and the call cost:

```sh
uv run --env-file .env.local bench.py --label menu
uv run --env-file .env.local bench.py --label match --whisper
```

Below 1× real time a sentence is made faster than it plays.

