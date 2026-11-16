# The Voice Worker

The ears and the voice of the [Enbraile bot](../../bot/explanation/bot.md#hearing-speaking-and-claude): a Python process in `home/voice/` that runs on the owner's PC, which has an RTX 5090, under WSL. The bot sends it what people say in the call; it sends back each transcript, the trigger words it heard and the bot's spoken replies.

## How It Works

On start, `worker.py` loads Whisper large-v3 through faster-whisper on the GPU (float16), runs it once on noise so the first real clip does not wait for the GPU to warm up, loads the warm voices (`WARM_VOICES`) and makes the chime with ffmpeg. It then opens a WebSocket to `<BOT_URL>/voice/connect` with `INTERNAL_SECRET`, tells the bot which voices it may load and which are loaded, and keeps the socket open, reconnecting with backoff when it drops. Other voices load when a module asks for them ([Voices](#voices)).

Each message on the socket is JSON text or a binary frame: a 4-byte big-endian header length, a JSON header, then the audio.

| From | Message | Meaning |
|------|---------|---------|
| Worker | `{"type": "voices", "voices": [names], "default": name, "loaded": [names]}` | The voices it may load, the one it speaks with when none is named, and the ones loaded now; sent on connect and after every load and unload |
| Bot | `{"type": "triggers", "words": [{"word": …, "ack": …}]}` | The trigger words modules registered; sent on connect and on every change |
| Bot | `{"type": "want", "voices": [names]}` | The voices modules hold; sent on connect and on every change |
| Bot | binary `{"type": "clip", "user": id, "at": ms}` + Ogg Opus | One person's speech, up to a pause of 0.8 s, and when it started |
| Worker | `{"type": "transcript", "user": id, "text": …, "at": ms, "ms": …}` | What was said, for the bot's transcripts |
| Worker | binary `{"type": "audio", "id": "ack"}` + Ogg Opus | Play now: a trigger word with `ack` was heard |
| Worker | `{"type": "trigger", "word": …, "user": id, "text": …}` | A trigger word and the words after it |
| Bot | `{"type": "say", "id": n, "text": …, "voice": name}` | Say this, in that voice (`voice` optional: the default) |
| Worker | binary `{"type": "audio", "id": n}` + Ogg Opus | The spoken text |
| Worker | `{"type": "failed", "id": n, "error": …}` | It could not say it: no voice is loaded, or the voice failed |

A clip is transcribed in Spanish with voice activity filtering, the trigger words as hotwords. Every non-empty transcript goes back to the bot. A trigger word is found anywhere in the transcript, by comparing each word lowercased, without accents or punctuation, and by sound: k is read as c, y as i, "th" as t and doubled letters as one, so Whisper's "Kari" is «cari» and "Richthofen" is «richtofen»; a trigger of six letters or more also allows one letter off (two from nine), while a shorter one must match exactly, so "caro" never wakes «cari». The request is everything after it. A word alone, or with less than two letters after it, waits: that person's next clip within 8 s is the request. The worker has no trigger word of its own, and with none registered nothing triggers. It keeps nothing and logs triggers and what happens to its voices ([run how-to](../how-to/run-the-voice-worker.md)).

### Voices

`VOICES` is the list of voices a module may ask for, comma-separated, and `DEFAULT_VOICE` the one used when a `say` names none (the first in the list if unset). `WARM_VOICES`, also from that list, load at start and stay loaded; unset, it is the default voice alone, and set empty (`WARM_VOICES=`) the worker starts with no voice loaded. The worker refuses to start on a name it does not know, or a default or warm voice outside the list.

Any other voice loads only while a module holds it. A module asks with `hearing.hold(owner, voice)` and lets go with `hearing.release(owner, voice)`, and the bot sends the worker the set of voices at least one module holds ([bot](../../bot/explanation/bot.md#hearing-speaking-and-claude)). The worker loads a held voice's engine when the first module asks for it and unloads it when no module holds it and it is not warm, freeing its GPU memory: the engine is dropped, Python's garbage is collected and torch's CUDA cache emptied. Engines load one at a time, on a thread, so clips are still transcribed meanwhile; an engine is never unloaded while it is speaking. A load that fails is logged and not tried again until the bot next sends the held voices.

A `say` names its voice with `hearing.say(text, { voice })`; the bot rejects a name outside `VOICES`. When the voice is loaded, it speaks. When it is still loading, the `say` waits for it, up to `LOAD_WAIT_S` (30 s); past that, or straight away when no module holds the voice, it speaks in a loaded voice instead, the default if loaded, else the first loaded in `VOICES`, and logs `voice <name> … speaking with <voice>`. With no voice loaded at all, or when the voice raises an error, it answers `failed`.

| Voice | Engine | What it is |
|-------|--------|------------|
| `piper` | Piper, `es_ES-davefx-medium` (`PIPER_VOICE`) | Fast and robotic; on the CPU, downloaded into `data/` the first time |
| `chatterbox` | Chatterbox Multilingual with Resemble's Spain Spanish T3 | A general Castilian voice, no reference clip; exaggeration 0.5, cfg_weight 0.5 |
| `chatterbox-expressive` | The same model | The same voice, livelier: exaggeration 0.8, cfg_weight 0.3 |
| `richtofen` | XTTS-v2 fine-tuned on Richtofen's BO3 Castilian dub | Richtofen, from a bundle kept outside git (`RICHTOFEN_DIR`, `data/richtofen/` by default) |

Both Chatterbox voices share one loaded model. Its directory, `data/chatterbox-es/`, is built on first start from links into the Hugging Face cache: `ve.pt`, `conds.pt`, `s3gen.pt` and `Cangjie5_TC.json` from `ResembleAI/chatterbox`, and from `ResembleAI/Chatterbox-Multilingual-es-es` (MIT) its `grapheme_mtl_merged_expanded_v1.json` and its `t3_es_es.safetensors`, linked under the name the loader wants, `t3_mtl23ls_v2.safetensors`. The finetune's own `s3gen_v3.pt` is not used: it does not load into the current S3Gen, and the accent lives in T3, so the base `s3gen.pt` keeps it. Chatterbox's first generation takes 12–20 s, so the worker speaks one word at start to warm it up.

Richtofen loads `model.pth`, `config.json` and `vocab.json` from the bundle and computes its conditioning on each load, from the eight clips in `refs/` (`gpt_cond_len=30`, `max_ref_length=60`); it speaks with temperature 0.65, top_p 0.85, top_k 50 and repetition_penalty 5.0, the owner's pick of four settings. Its weakness is dropping or garbling words in long sentences, so each of its sentences is heard back with the already-loaded Whisper: when Whisper finds less than 80 % of the sentence's words, it is made again, up to three tries, keeping the best. How the bundle is made: [Remake the Richtofen Voice](../how-to/remake-the-richtofen-voice.md).

Chatterbox and Richtofen speak a reply one sentence at a time, split after `.`, `!`, `?` or `…`, joined with 0.15 s of silence. All voices are encoded to 48 kHz stereo Ogg Opus with ffmpeg, which the bot plays without decoding. Replies are made one at a time, in the order the bot asks, so a reply waiting for its voice to load holds back the replies after it.

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

From the worker on 2026-11-16, voices on demand: a local worker with `VOICES=piper,richtofen` and the default `piper` warm, driven by a scripted host on localhost that asked for Richtofen, had it speak a 14-word sentence to a file and let it go, while another worker was running on the same card.

| Fact | Measurement |
|------|-------------|
| Richtofen loaded on demand | 15.9 s and 26.5 s in two runs |
| A `say` sent with the request for Richtofen, answered in his voice | 28.3 s after it was sent, the load included |
| GPU memory, Richtofen loaded on demand / after it was let go | 2.0–2.2 GB up / 1.9–2.0 GB down again |
| A `say` for Richtofen while no module held him / while still loading with `LOAD_WAIT_S=3` | Spoken by Piper at once / Spoken by Piper after 3.4 s |

The research before the build, by another session on 2026-11-15/16: in a call the owner compared Piper, Kokoro and Pocket TTS, which sounded robotic or flat, with Chatterbox Multilingual, clearly the best general voice but with a Mexican accent until Resemble's Spain finetune. Zero-shot cloning of Richtofen with Chatterbox and RVC got his intonation wrong; XTTS-v2 fine-tuned on about 2 h of his dub lines was far better, about 1.6–2.7 s a sentence and 2 GB then. A second round of fine-tuning plateaued and dropped words, so the first is the model.

## Decisions

- **Trigger words match by sound:** in the owner's calls Whisper wrote «cari» as "Kari" 13 times against 16 as "cari", and «richtofen» as "Richthofen" 4 times and "Rictofen" once, all of which the exact match missed; matching by sound, with one or two letters' slack for long words only, catches them without waking on "caro". _(owner reported it, the matching the agent's choice, 2026-11-16)_
- **faster-whisper large-v3 on CTranslate2, not turbo:** turbo is twice as fast, but large-v3 already answers in a quarter of a second; accuracy matters more. _(owner asked for faster-whisper on CTranslate2, 2026-11-15; the model the agent's choice)_
- **PyAV 16.1.0:** PyAV 19, the newest, dropped an argument faster-whisper 1.2.1 passes, and 14 has no wheels for Python 3.13. _(forced by the versions, 2026-11-15)_
- **Voices configurable, with a list of the voices modules may ask for and a default:** the owner games on this PC, so GPU memory matters; modules may pick a voice. Piper stays. _(owner, 2026-11-16)_
- **Voices load on demand, decided by modules:** a voice loads when a module needs it and unloads, freeing GPU memory, when none does; `VOICES` is the list a module may ask for. _(owner, 2026-11-16)_
- **A module's request for a voice is a lease, `hearing.hold(owner, voice)` and `hearing.release(owner, voice)`, and the bot sends the worker the whole set held, like the trigger words:** the shape of `voice.hold`, which modules already use; a whole set, resent on connect, leaves the worker nothing to reconcile after a reconnect or a bot restart. A `say` does not ask for its voice by itself, so nothing loads that no module held. _(the agent's choice, 2026-11-16)_
- **`WARM_VOICES` defaults to the default voice:** a module that names no voice, as Cari does until she asks for her attempt's voice, keeps being heard without holding one; `WARM_VOICES=` starts with nothing loaded. _(the agent's choice, 2026-11-16)_
- **A `say` waits up to 30 s for a voice still loading, then speaks in a loaded voice, the default first; with none loaded it fails; the bot's `say` gives up after 60 s, up from 30 s:** Richtofen loads in 10–27 s, so a reply asked for with the voice usually still comes in it; Chatterbox, about 40 s cold, falls back the first time. A fallback is better heard than lost. The 30 s and the 60 s are the agent's starting values. _(the agent's choice, 2026-11-16)_
- **Chatterbox Multilingual with the Spain Spanish finetune as the general voice, in two presets (0.5/0.5 and 0.8/0.3):** the best-sounding general voice in the owner's comparison, and the finetune fixes its Mexican accent. _(owner, 2026-11-16)_
- **Richtofen as the first round of XTTS-v2 fine-tuned on his BO3 Castilian dub, with the owner's sampling settings:** zero-shot cloning got his intonation wrong; the second round plateaued and dropped words. The model, its reference clips and the game audio stay out of git: the audio is the game's and XTTS's licence (CPML) is non-commercial. _(owner, 2026-11-16)_
- **A module picks a voice with `hearing.say(text, { voice })`, the worker's default when it names none, and the worker announces its voices on connect and after every load and unload:** the smallest change to `say`; through `say`, a name outside `VOICES` fails at once, while a voice in `VOICES` that is not loaded is spoken in a loaded one ([Voices](#voices)); the worker itself treats an unknown name as its default, and a `say` sent before the worker's `voices` message arrives, just after it connects, is rejected. _(the agent's choice, 2026-11-16)_
- **Richtofen's sentences heard back by Whisper and remade, up to three tries, below 80 % of the words:** splitting into sentences alone still dropped a seven-word clause from the longest sentence in the probe; Whisper is already loaded, and the check added about 0.4–0.6 s a sentence there. The threshold and the tries are the agent's starting values. _(the agent's choice, 2026-11-16)_
- **One environment on Python 3.13 for every voice:** `chatterbox-tts` 0.1.7 and `coqui-tts` 0.28.0 resolve together once torch is overridden to 2.11.0+cu128 (Chatterbox pins 2.6.0, which has no CUDA 12.8 build for the RTX 5090) and transformers settles on Chatterbox's 5.2.0, which Coqui accepts; both spoke from it. One process keeps one CUDA context and lets Richtofen reuse Whisper. _(the agent's choice after the probe, 2026-11-16)_
- **The CUDA libraries from Python wheels, now torch's `nvidia-cublas-cu12` and `nvidia-cudnn-cu12`,** loaded by the worker before CTranslate2, so the PC needs only the NVIDIA driver (the agent's choice, 2026-11-15). torch 2.11+cu128 pins `nvidia-cudnn-cu12` 9.19, which conflicts with the 9.28 the worker pinned for CTranslate2, and CTranslate2 runs on torch's. `libnvblas` is not preloaded: with it, the worker crashed (exit 139) while loading the TTS models, right after NVBLAS announced itself, and the same run without it passed. torchcodec comes from PyTorch's CPU index because the PyPI build wants CUDA 13's `libnvrtc.so.13`. _(forced by the versions, 2026-11-16)_
