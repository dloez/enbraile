# The Voice Worker

The ears and the voice of the [Enbraile bot](../../bot/explanation/bot.md#hearing-speaking-and-claude): a Python process in `home/voice/` that runs on the owner's PC, which has an RTX 5090, under WSL. The bot sends it what people say in the call; it sends back each transcript, the trigger words it heard and the bot's spoken replies.

## How It Works

On start, `worker.py` loads Whisper large-v3 through faster-whisper on the GPU (float16), runs it once on noise so the first real clip does not wait for the GPU to warm up, loads the Piper voice `es_ES-davefx-medium` (downloaded into `data/` the first time) and makes the chime with ffmpeg. It then opens a WebSocket to `<BOT_URL>/voice/connect` with `INTERNAL_SECRET` and keeps it open, reconnecting with backoff when it drops.

Each message on the socket is JSON text or a binary frame: a 4-byte big-endian header length, a JSON header, then the audio.

| From | Message | Meaning |
|------|---------|---------|
| Bot | `{"type": "triggers", "words": [{"word": …, "ack": …}]}` | The trigger words modules registered; sent on connect and on every change |
| Bot | binary `{"type": "clip", "user": id, "at": ms}` + Ogg Opus | One person's speech, up to a pause of 0.8 s, and when it started |
| Worker | `{"type": "transcript", "user": id, "text": …, "at": ms, "ms": …}` | What was said, for the bot's transcripts |
| Worker | binary `{"type": "audio", "id": "ack"}` + Ogg Opus | Play now: a trigger word with `ack` was heard |
| Worker | `{"type": "trigger", "word": …, "user": id, "text": …}` | A trigger word and the words after it |
| Bot | `{"type": "say", "id": n, "text": …}` | Say this |
| Worker | binary `{"type": "audio", "id": n}` + Ogg Opus | The spoken text |

A clip is transcribed in Spanish with voice activity filtering, the trigger words as hotwords. Every non-empty transcript goes back to the bot. A trigger word is found anywhere in the transcript, by comparing each word lowercased, without accents or punctuation; the request is everything after it. A word alone, or with less than two letters after it, waits: that person's next clip within 8 s is the request. The worker has no trigger word of its own, and with none registered nothing triggers. It keeps nothing and logs only triggers.

Speech is made with Piper in the process, about 0.1 s a sentence, and encoded to 48 kHz stereo Ogg Opus with ffmpeg, which the bot plays without decoding.

## Measurements

From throwaway probes on 2026-11-15.

| Fact | Measurement |
|------|-------------|
| Whisper large-v3 on a 3 s Spanish clip, warm | 0.25 s; large-v3-turbo 0.13 s, both word for word |
| The first transcription after loading, without a warm-up | about 18 s |
| From the end of speech in Discord to the transcript, 17 clips in a call | 0.32 s on average, 0.50 s at most |
| Piper, `es_ES-davefx-medium`, one sentence | 0.65 s as a new process each time; 0.06–0.1 s loaded in the worker |
| Clips with no speech in them, as judged by the voice activity filter | 7 of 24 in the first call |
| «Bad Bunny» spoken by the Piper voice | Heard as «barbuni» |

## Decisions

- **faster-whisper large-v3 on CTranslate2, not turbo:** turbo is twice as fast, but large-v3 already answers in a quarter of a second; accuracy matters more. _(owner asked for faster-whisper on CTranslate2, 2026-11-15; the model the agent's choice)_
- **PyAV 16.1.0:** PyAV 19, the newest, dropped an argument faster-whisper 1.2.1 passes, and 14 has no wheels for Python 3.13. _(forced by the versions, 2026-11-15)_
- **The CUDA libraries from the `nvidia-cublas-cu12` and `nvidia-cudnn-cu12` wheels,** loaded by the worker before CTranslate2, so the PC needs only the NVIDIA driver. _(the agent's choice, 2026-11-15)_
- **Piper with the `es_ES-davefx-medium` voice:** local, fast and Spanish from Spain; the first voice tried. _(the agent's choice, 2026-11-15)_
