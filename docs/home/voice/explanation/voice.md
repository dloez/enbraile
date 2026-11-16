# The Voice Worker

The ears and the voice of the [Enbraile bot](../../bot/explanation/bot.md#hearing-speaking-and-claude): a Python process in `home/voice/` that runs on the owner's PC, which has an RTX 5090, under WSL. The bot sends it what people say in the call; it sends back each transcript, the trigger words it heard and the bot's spoken replies.

## How It Works

On start, `worker.py` loads Whisper large-v3 through faster-whisper on the GPU (float16), runs it once on noise so the first real clip does not wait for the GPU to warm up, loads the voices `VOICES` enables and makes the chime with ffmpeg. It then opens a WebSocket to `<BOT_URL>/voice/connect` with `INTERNAL_SECRET`, tells the bot which voices it has and keeps the socket open, reconnecting with backoff when it drops.

Each message on the socket is JSON text or a binary frame: a 4-byte big-endian header length, a JSON header, then the audio.

| From | Message | Meaning |
|------|---------|---------|
| Worker | `{"type": "voices", "voices": [names], "default": name}` | The voices it loaded and the one it speaks with when none is named; sent on connect |
| Bot | `{"type": "triggers", "words": [{"word": …, "ack": …}]}` | The trigger words modules registered; sent on connect and on every change |
| Bot | binary `{"type": "clip", "user": id, "at": ms}` + Ogg Opus | One person's speech, up to a pause of 0.8 s, and when it started |
| Worker | `{"type": "transcript", "user": id, "text": …, "at": ms, "ms": …}` | What was said, for the bot's transcripts |
| Worker | binary `{"type": "audio", "id": "ack"}` + Ogg Opus | Play now: a trigger word with `ack` was heard |
| Worker | `{"type": "trigger", "word": …, "user": id, "text": …}` | A trigger word and the words after it |
| Bot | `{"type": "say", "id": n, "text": …, "voice": name}` | Say this, in that voice (`voice` optional: the default) |
| Worker | binary `{"type": "audio", "id": n}` + Ogg Opus | The spoken text |

A clip is transcribed in Spanish with voice activity filtering, the trigger words as hotwords. Every non-empty transcript goes back to the bot. A trigger word is found anywhere in the transcript, by comparing each word lowercased, without accents or punctuation; the request is everything after it. A word alone, or with less than two letters after it, waits: that person's next clip within 8 s is the request. The worker has no trigger word of its own, and with none registered nothing triggers. It keeps nothing and logs only triggers.

### Voices

`VOICES` is the allow-list, comma-separated, and `DEFAULT_VOICE` the one used when a `say` names none (the first in the list if unset). Only the engines an enabled voice needs are imported and loaded, so a disabled voice costs no GPU memory; the worker refuses to start on a name it does not know or a default outside the list. A module picks a voice with `hearing.say(text, { voice })`; the bot rejects a name the worker did not list ([bot](../../bot/explanation/bot.md#hearing-speaking-and-claude)).

| Voice | Engine | What it is |
|-------|--------|------------|
| `piper` | Piper, `es_ES-davefx-medium` (`PIPER_VOICE`) | Fast and robotic; on the CPU, downloaded into `data/` the first time |
| `chatterbox` | Chatterbox Multilingual with Resemble's Spain Spanish T3 | A general Castilian voice, no reference clip; exaggeration 0.5, cfg_weight 0.5 |
| `chatterbox-expressive` | The same model | The same voice, livelier: exaggeration 0.8, cfg_weight 0.3 |
| `richtofen` | XTTS-v2 fine-tuned on Richtofen's BO3 Castilian dub | Richtofen, from a bundle kept outside git (`RICHTOFEN_DIR`, `data/richtofen/` by default) |

Both Chatterbox voices share one loaded model. Its directory, `data/chatterbox-es/`, is built on first start from links into the Hugging Face cache: `ve.pt`, `conds.pt`, `s3gen.pt` and `Cangjie5_TC.json` from `ResembleAI/chatterbox`, and from `ResembleAI/Chatterbox-Multilingual-es-es` (MIT) its `grapheme_mtl_merged_expanded_v1.json` and its `t3_es_es.safetensors`, linked under the name the loader wants, `t3_mtl23ls_v2.safetensors`. The finetune's own `s3gen_v3.pt` is not used: it does not load into the current S3Gen, and the accent lives in T3, so the base `s3gen.pt` keeps it. Chatterbox's first generation takes 12–20 s, so the worker speaks one word at start to warm it up.

Richtofen loads `model.pth`, `config.json` and `vocab.json` from the bundle and computes its conditioning once, at start, from the eight clips in `refs/` (`gpt_cond_len=30`, `max_ref_length=60`); it speaks with temperature 0.65, top_p 0.85, top_k 50 and repetition_penalty 5.0, the owner's pick of four settings. Its weakness is dropping or garbling words in long sentences, so each of its sentences is heard back with the already-loaded Whisper: when Whisper finds less than 80 % of the sentence's words, it is made again, up to three tries, keeping the best. How the bundle is made: [Remake the Richtofen Voice](../how-to/remake-the-richtofen-voice.md).

Chatterbox and Richtofen speak a reply one sentence at a time, split after `.`, `!`, `?` or `…`, joined with 0.15 s of silence. All voices are encoded to 48 kHz stereo Ogg Opus with ffmpeg, which the bot plays without decoding. Replies are made one at a time, in the order the bot asks.

Everything runs in one uv environment on Python 3.13: torch and torchaudio 2.11 as CUDA 12.8 builds (the RTX 5090 needs at least that), `chatterbox-tts` with its own torch pin overridden, `coqui-tts[codec]` with `six`, and torchcodec from PyTorch's CPU index. Torch's cuBLAS and cuDNN wheels also serve CTranslate2, which the worker preloads, skipping `libnvblas`.

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

From the worker on 2026-11-16, writing to files, every voice enabled unless a row says otherwise: a short sentence (11 words) and a reply of three sentences (44 words), each made twice, the second time timed. Times are wall-clock; GPU memory is the card's total read with `nvidia-smi` before and after each load, so it includes other programs' changes.

| Fact | Measurement |
|------|-------------|
| GPU memory added: Whisper large-v3 / Chatterbox / Richtofen / Piper | about 4.2 GB / 3.4 GB / 1.8–2.1 GB / none |
| The worker with only `piper` enabled / only `richtofen` enabled, loaded | 4.3 GB / 6.3 GB |
| The worker with all four voices, loaded and while speaking | 9.4 GB; 9.9 GB at the peak (torch's own peak 5.4 GB) |
| Start with all four voices | 35 s, warm-ups included (the first start also downloads) |
| Short sentence, warm: Chatterbox / expressive / Richtofen / Piper | 1.5 s / 1.9 s / 1.0 s (1.4 s with the Whisper check) / 0.04 s |
| Three-sentence reply, warm: Chatterbox / expressive / Richtofen / Piper | 5.9 s / 6.8 s / 2.9 s (4.8 s with the check) / 0.17–0.23 s |
| Richtofen's three-sentence reply, sentence by sentence, without the check | Dropped «y llevarlas a la mesa de trabajo» from its longest sentence |
| The same with the check | Every word, in a run where no sentence needed a second try |
| Every voice's output, transcribed back by Whisper | Word for word, but for «Enbraile», heard as «Embraile» or «Mimbrele» |

The research before the build, by another session on 2026-11-15/16: in a call the owner compared Piper, Kokoro and Pocket TTS, which sounded robotic or flat, with Chatterbox Multilingual, clearly the best general voice but with a Mexican accent until Resemble's Spain finetune. Zero-shot cloning of Richtofen with Chatterbox and RVC got his intonation wrong; XTTS-v2 fine-tuned on about 2 h of his dub lines was far better, about 1.6–2.7 s a sentence and 2 GB then. A second round of fine-tuning plateaued and dropped words, so the first is the model.

## Decisions

- **faster-whisper large-v3 on CTranslate2, not turbo:** turbo is twice as fast, but large-v3 already answers in a quarter of a second; accuracy matters more. _(owner asked for faster-whisper on CTranslate2, 2026-11-15; the model the agent's choice)_
- **PyAV 16.1.0:** PyAV 19, the newest, dropped an argument faster-whisper 1.2.1 passes, and 14 has no wheels for Python 3.13. _(forced by the versions, 2026-11-15)_
- **Voices configurable, with an allow-list and a default; only enabled voices load:** the owner games on this PC, so GPU memory matters; modules may pick a voice. Piper stays. _(owner, 2026-11-16)_
- **Chatterbox Multilingual with the Spain Spanish finetune as the general voice, in two presets (0.5/0.5 and 0.8/0.3):** the best-sounding general voice in the owner's comparison, and the finetune fixes its Mexican accent. _(owner, 2026-11-16)_
- **Richtofen as the first round of XTTS-v2 fine-tuned on his BO3 Castilian dub, with the owner's sampling settings:** zero-shot cloning got his intonation wrong; the second round plateaued and dropped words. The model, its reference clips and the game audio stay out of git: the audio is the game's and XTTS's licence (CPML) is non-commercial. _(owner, 2026-11-16)_
- **A module picks a voice with `hearing.say(text, { voice })`, the worker's default when it names none, and the worker announces its voices on connect:** the smallest change to `say`; through `say`, a name the worker does not have fails at once rather than being spoken in another voice; the worker itself speaks an unknown name in its default, and a `say` sent before the worker's `voices` message arrives, just after it connects, is rejected. _(the agent's choice, 2026-11-16)_
- **Richtofen's sentences heard back by Whisper and remade, up to three tries, below 80 % of the words:** splitting into sentences alone still dropped a seven-word clause from the longest sentence in the probe; Whisper is already loaded, and the check added about 0.4–0.6 s a sentence there. The threshold and the tries are the agent's starting values. _(the agent's choice, 2026-11-16)_
- **One environment on Python 3.13 for every voice:** `chatterbox-tts` 0.1.7 and `coqui-tts` 0.28.0 resolve together once torch is overridden to 2.11.0+cu128 (Chatterbox pins 2.6.0, which has no CUDA 12.8 build for the RTX 5090) and transformers settles on Chatterbox's 5.2.0, which Coqui accepts; both spoke from it. One process keeps one CUDA context and lets Richtofen reuse Whisper. _(the agent's choice after the probe, 2026-11-16)_
- **The CUDA libraries from Python wheels, now torch's `nvidia-cublas-cu12` and `nvidia-cudnn-cu12`,** loaded by the worker before CTranslate2, so the PC needs only the NVIDIA driver (the agent's choice, 2026-11-15). torch 2.11+cu128 pins `nvidia-cudnn-cu12` 9.19, which conflicts with the 9.28 the worker pinned for CTranslate2, and CTranslate2 runs on torch's. `libnvblas` is not preloaded: with it, the worker crashed (exit 139) while loading the TTS models, right after NVBLAS announced itself, and the same run without it passed. torchcodec comes from PyTorch's CPU index because the PyPI build wants CUDA 13's `libnvrtc.so.13`. _(forced by the versions, 2026-11-16)_
