# The Voice Worker

The ears and the voice of the [Enbraile bot](../../bot/explanation/bot.md#hearing-speaking-and-claude): a Python process in `home/voice/` that runs on the owner's PC, which has an RTX 5090, under WSL. The bot sends it what people say in the call; it sends back each transcript, the trigger words it heard and the bot's spoken replies.

## How It Works

On start, `worker.py` loads Whisper large-v3 through faster-whisper on the GPU (float16), runs it once on noise so the first real clip does not wait for the GPU to warm up, loads the warm voices (`WARM_VOICES`) and makes the chime with ffmpeg. Each trigger whose `ack` carries lines in a voice has those lines spoken once in that voice as soon as it is loaded, one at a time between replies, and kept in memory for the life of the process (it logs `acks ready in <voice>: <n>`). It then opens a WebSocket to `<BOT_URL>/voice/connect` with `INTERNAL_SECRET`, tells the bot which voices it may load and which are loaded, and keeps the socket open, reconnecting with backoff when it drops. Other voices load when a module asks for them ([Voices](#voices)).

Each message on the socket is JSON text or a binary frame: a 4-byte big-endian header length, a JSON header, then the audio.

| From | Message | Meaning |
|------|---------|---------|
| Worker | `{"type": "voices", "voices": [names], "default": name, "loaded": [names]}` | The voices it may load, the one it speaks with when none is named, and the ones loaded now; sent on connect and after every load and unload |
| Bot | `{"type": "triggers", "words": [{"word": …, "ack": true | false | {"voice": …, "lines": […]}}]}` | The trigger words modules registered; sent on connect and on every change |
| Bot | `{"type": "want", "voices": [names]}` | The voices modules hold; sent on connect and on every change |
| Bot | binary `{"type": "clip", "user": id, "at": ms}` + Ogg Opus | One person's speech, up to a pause of 0.5 s, and when it started |
| Worker | `{"type": "transcript", "user": id, "text": …, "at": ms, "ms": …}` | What was said, for the bot's transcripts; empty when the clip held no speech, which tells the bot the clip is done |
| Worker | binary `{"type": "audio", "id": "ack"}` + Ogg Opus | Play now: a trigger word with `ack` was heard; for an `ack` of lines in a voice, one of its lines once they are made, and nothing at all while that voice is not loaded; for a plain `ack`, the chime |
| Worker | `{"type": "trigger", "word": …, "user": id, "text": …}` | A trigger word and the words after it |
| Bot | `{"type": "say", "id": n, "text": …, "voice": name}` | Say this, in that voice (`voice` optional: the default) |
| Worker | binary `{"type": "audio", "id": n}` + Ogg Opus | The spoken text |
| Worker | `{"type": "failed", "id": n, "error": …}` | It could not say it: no voice is loaded, or the voice failed |

A clip is transcribed in Spanish with voice activity filtering, the trigger words as hotwords. Every transcript goes back to the bot, an empty one too. A trigger word is found anywhere in the transcript, by comparing each word lowercased, without accents or punctuation, and by sound: k is read as c, y as i, "th" as t and doubled letters as one, so Whisper's "Bebe" is «bebé» and "Richthofen" is «richtofen»; a trigger of six letters or more also allows one letter off (two from nine), while a shorter one must match exactly, so "bebo" never wakes «bebé». The request is everything after it. A word alone, or with less than two letters after it, waits: that person's next clip within 8 s is the request. The worker has no trigger word of its own, and with none registered nothing triggers. It keeps nothing and logs triggers and what happens to its voices ([run how-to](../how-to/run-the-voice-worker.md)).

### Voices

`VOICES` is the list of voices a module may ask for, comma-separated, and `DEFAULT_VOICE` the one used when a `say` names none (the first in the list if unset). `WARM_VOICES`, also from that list, load at start and stay loaded; unset, it is the default voice alone, and set empty (`WARM_VOICES=`) the worker starts with no voice loaded. The worker refuses to start on a name it does not know, or a default or warm voice outside the list.

Any other voice loads only while a module holds it. A module asks with `hearing.hold(owner, voice)` and lets go with `hearing.release(owner, voice)`, and the bot sends the worker the set of voices at least one module holds ([bot](../../bot/explanation/bot.md#hearing-speaking-and-claude)). The worker loads a held voice's engine when the first module asks for it and unloads it when no module holds it and it is not warm, freeing its GPU memory: the engine is dropped, Python's garbage is collected and torch's CUDA cache emptied. Engines load one at a time, on a thread, so clips are still transcribed meanwhile; an engine is never unloaded while it is speaking. A load that fails is logged and not tried again until the bot next sends the held voices.

A `say` names its voice with `hearing.say(text, { voice })`; the bot rejects a name outside `VOICES`. When the voice is loaded, it speaks. When it is still loading, the `say` waits for it, up to `LOAD_WAIT_S` (30 s); past that, or straight away when no module holds the voice, it speaks in a loaded voice instead, the default if loaded, else the first loaded in `VOICES`, and logs `voice <name> … speaking with <voice>`. With no voice loaded at all, or when the voice raises an error, it answers `failed`.

| Voice | Engine | What it is |
|-------|--------|------------|
| `piper` | Piper, `es_ES-davefx-medium` (`PIPER_VOICE`) | Fast and robotic; on the CPU, downloaded into `data/` the first time |
| `chatterbox` | Chatterbox Multilingual with Resemble's Spain Spanish T3 | A general Castilian voice, no reference clip; exaggeration 0.5, cfg_weight 0.5 |
| `chatterbox-expressive` | The same model | The same voice, livelier: exaggeration 0.8, cfg_weight 0.3 |
| `richtofen` | Fun-CosyVoice3-0.5B with its language model and decoder fine-tuned on Richtofen's BO3 Castilian dub | Richtofen, from a bundle kept outside git (`RICHTOFEN_DIR`, `data/richtofen-cosyvoice/` by default) |

Both Chatterbox voices share one loaded model. Its directory, `data/chatterbox-es/`, is built on first start from links into the Hugging Face cache: `ve.pt`, `conds.pt`, `s3gen.pt` and `Cangjie5_TC.json` from `ResembleAI/chatterbox`, and from `ResembleAI/Chatterbox-Multilingual-es-es` (MIT) its `grapheme_mtl_merged_expanded_v1.json` and its `t3_es_es.safetensors`, linked under the name the loader wants, `t3_mtl23ls_v2.safetensors`. The finetune's own `s3gen_v3.pt` is not used: it does not load into the current S3Gen, and the accent lives in T3, so the base `s3gen.pt` keeps it. Chatterbox's first generation takes 12–20 s, so the worker speaks one word at start to warm it up.

Richtofen runs CosyVoice's own code, which is not a Python package: on first load the worker clones it at a pinned commit (`COSYVOICE_COMMIT` in `worker.py`) with its Matcha-TTS submodule into `data/cosyvoice/` and puts it on the import path. The bundle holds CosyVoice3's files with the fine-tuned `llm.pt` and `flow.pt`, plus `ref.wav` and `ref.txt`, a 5 s line of his and its words, which become the speaker prompt on each load. Five things are changed from outside CosyVoice's code when it loads:

- Its Qwen2 backbone is loaded in float32, since transformers 5.2 (Chatterbox's pin) would load it in bfloat16 under the float32 weights.
- Each generation step is run without CosyVoice's attention mask, which covers only the newest token; transformers 4 ignored it, while 5 hides the earlier tokens with it, and the model then never stopped.
- The size of the first chunk is set to 16 speech tokens before every sentence (`RICHTOFEN_HOP`); CosyVoice doubles it after each chunk and never resets it, so from the second sentence on the first audio waited for a 4 s chunk.
- The decoder runs 5 steps instead of 10 (`RICHTOFEN_STEPS`).
- Its wait for new tokens polls every 0.01 s instead of 0.1 s.

Richtofen always streams: each sentence's chunks go to one ffmpeg per reply, whose Ogg pages go to the bot as they come (`{"type": "audio", "id", "stream": true}` frames, the last with `"end": true`), and the bot plays them as one stream. Before speaking, each reply's text is prepared: a sentence of fewer than three words is joined to the next (the last to the one before), German words are written as a Spanish reader would say them («Mein Gott» as «main got», `SOUNDED` in `worker.py`), «…» becomes a comma, or a full stop at the end, and numbers are written out in Spanish (num2words). CosyVoice's own text frontend is off: it would spell numbers in English and downloads normalisers from modelscope.cn on every start. How the bundle is made: [Remake the Richtofen Voice](../how-to/remake-the-richtofen-voice.md).

Chatterbox and Richtofen speak a reply one sentence at a time, split after `.`, `!`, `?` or `…`, joined with 0.15 s of silence. All voices are encoded to 48 kHz stereo Ogg Opus with ffmpeg, which the bot plays without decoding. Replies are made one at a time, in the order the bot asks, so a reply waiting for its voice to load holds back the replies after it.

Everything runs in one uv environment on Python 3.13: torch and torchaudio 2.11 as CUDA 12.8 builds (the RTX 5090 needs at least that), `chatterbox-tts` with its own torch pin overridden, CosyVoice's dependencies (HyperPyYAML, openai-whisper, x-transformers, modelscope, hydra-core, lightning, pyworld and the rest its modules import, each pinned), num2words, and torchcodec from PyTorch's CPU index. Its ONNX models (the speaker encoder and the speech tokenizer, used once per load for the prompt) run on the CPU through the `onnxruntime` Piper brings. Torch's cuBLAS and cuDNN wheels also serve CTranslate2, which the worker preloads, skipping `libnvblas`.

## Measurements

From throwaway probes on 2026-11-17, Richtofen on CosyVoice3 on the RTX 5090, with the live worker running beside it on the same card:

| Fact | Measurement |
|------|-------------|
| First audio, untouched / with the chunk size reset each sentence / and 5 decoder steps | about 1.4 s / about 1.0 s / about 0.65 s |
| Where the first chunk's time went, before the step cut | language model's first 20 tokens by 0.3 s; the decoder 0.8 s for the first chunk |
| fp16 | slower (1.16 s against 0.98 s); not used |
| First chunk of 12 / 16 / 20 / 25 tokens at 5 steps: first audio, and the worst wait for a later chunk once playing | 0.68 s, 0.26–0.35 s (heard as a stutter) / 0.92 s, none / 0.93 s, none / 1.14 s, none |
| Through the bot to the call, a reply of four sentences | first audio 0.51 s for «¡Mein Gott!», 1.1–1.3 s for the others |
| Load, warm-up included | 19–23 s |
| Six lines from his manner, heard back by Whisper | every word in all six, but «Mein Gott» heard as «Main got» and «Ausgezeichnet» as «Osgeseichnet» |
| Fine-tuning on 1,628 clips (89 min), 8 epochs each | language model about 25 s an epoch, its held-out loss lowest after epoch 1 and rising from epoch 3; decoder about 25 s an epoch, its loss lowest after epoch 5 |
| Qwen3-TTS 1.7B: zero-shot / fine-tuned | about 3 s to make a 3 s line, every word / its four checkpoints ignored the text and babbled |

From throwaway probes on 2026-11-17, Richtofen on XTTS-v2, the voice before CosyVoice, the same sampling settings:

| Fact | Measurement |
|------|-------------|
| First audio of a short sentence (5–12 words): whole sentence with the Whisper check / whole without it / streamed | 0.95–1.6 s / 0.7–1.0 s / 0.16–0.18 s |
| The Whisper check on one 5-word sentence that kept failing | 14.9 s over three tries |
| First audio through the worker to a WebSocket, streamed 8 words / whole 20 words | 0.56 s / 2.29 s |
| Sentences heard back below 80 % of their words: whole, unchecked / streamed | 2 of 20 / 4 of 20; streamed at temperature 0.65, 0.4 and 0.2: 6, 7 and 5 of 36 |
| 24 lines in his manner, 3 takes each: takes with two or more words Whisper heard that are not in the text, streamed / whole | raw text 30 / 30 of 72; prepared text 12 / 9 of 72 |
| The same with prepared text, on the model retrained on the cleaned clips | 11 / 10 of 72; audio outside any heard word 0.32 s a take against 0.34 s, 11 takes over 1 s in both |

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

- **Trigger words match by sound:** in the owner's calls Whisper spelt the coach's wake word of the time with a K 13 times against 16 with a C, and «richtofen» as "Richthofen" 4 times and "Rictofen" once, all of which the exact match missed; matching by sound, with one or two letters' slack for long words only, catches them without waking on "caro". _(owner reported it, the matching the agent's choice, 2026-11-16)_
- **faster-whisper large-v3 on CTranslate2, not turbo:** turbo is twice as fast, but large-v3 already answers in a quarter of a second; accuracy matters more. _(owner asked for faster-whisper on CTranslate2, 2026-11-15; the model the agent's choice)_
- **PyAV 16.1.0:** PyAV 19, the newest, dropped an argument faster-whisper 1.2.1 passes, and 14 has no wheels for Python 3.13. _(forced by the versions, 2026-11-15)_
- **Voices configurable, with a list of the voices modules may ask for and a default:** the owner games on this PC, so GPU memory matters; modules may pick a voice. Piper stays. _(owner, 2026-11-16)_
- **Voices load on demand, decided by modules:** a voice loads when a module needs it and unloads, freeing GPU memory, when none does; `VOICES` is the list a module may ask for. _(owner, 2026-11-16)_
- **A module's request for a voice is a lease, `hearing.hold(owner, voice)` and `hearing.release(owner, voice)`, and the bot sends the worker the whole set held, like the trigger words:** the shape of `voice.hold`, which modules already use; a whole set, resent on connect, leaves the worker nothing to reconcile after a reconnect or a bot restart. A `say` does not ask for its voice by itself, so nothing loads that no module held. _(the agent's choice, 2026-11-16)_
- **`WARM_VOICES` defaults to the default voice:** a module that names no voice, as the zombies coach does until it asks for its attempt's voice, keeps being heard without holding one; `WARM_VOICES=` starts with nothing loaded. _(the agent's choice, 2026-11-16)_
- **A `say` waits up to 30 s for a voice still loading, then speaks in a loaded voice, the default first; with none loaded it fails; the bot's `say` gives up after 60 s, up from 30 s:** Richtofen loads in 10–27 s, so a reply asked for with the voice usually still comes in it; Chatterbox, about 40 s cold, falls back the first time. A fallback is better heard than lost. The 30 s and the 60 s are the agent's starting values. _(the agent's choice, 2026-11-16)_
- **Chatterbox Multilingual with the Spain Spanish finetune as the general voice, in two presets (0.5/0.5 and 0.8/0.3):** the best-sounding general voice in the owner's comparison, and the finetune fixes its Mexican accent. _(owner, 2026-11-16)_
- **Richtofen on CosyVoice3, its language model fine-tuned for 3 epochs and its decoder for 6, first chunk 16 tokens, 5 decoder steps:** the owner compared it by ear in a call against XTTS and against CosyVoice3 without fine-tuning and chose it; it says every word, where XTTS invented words in about 1 take in 6 even with prepared text. The epochs were picked by ear from the held-out loss's best; 5 steps did not change what Whisper heard and cut the first audio by a third; 16 is the smallest first chunk without a stutter. The model, its reference clip and the game audio stay out of git: the audio is the game's. _(owner chose it by ear, 2026-11-17; the settings measured, the agent's choice)_
- **Richtofen's text prepared before speaking:** with XTTS, short sentences, German words and ellipses were where it invented words, and preparing them cut takes with invented words from 30 to 12 of 72; CosyVoice keeps it, since on the raw text it misread «toquéis» and garbled «Ausgezeichnet», which the prepared text fixed. _(owner asked to make the voice more robust, measured, 2026-11-17)_
- **Numbers written out in Spanish by the worker, CosyVoice's text frontend off:** the frontend spells digits in English for any non-Chinese text and fetches its normalisers from modelscope.cn, which stalled the first start for minutes. _(the agent's choice, 2026-11-17)_
- **Qwen3-TTS rejected:** zero-shot it said the words but took about 3 s for a 3 s line, its Python package does not stream, and its fine-tune ignored the text in every checkpoint. _(the agent's choice, measured, 2026-11-17)_
- **CosyVoice inside the worker's environment rather than its own:** one process keeps one CUDA context and the worker's voice loading; transformers 5.2 needed only the two load-time changes above. _(the agent's choice, 2026-11-17)_
- **A module picks a voice with `hearing.say(text, { voice })`, the worker's default when it names none, and the worker announces its voices on connect and after every load and unload:** the smallest change to `say`; through `say`, a name outside `VOICES` fails at once, while a voice in `VOICES` that is not loaded is spoken in a loaded one ([Voices](#voices)); the worker itself treats an unknown name as its default, and a `say` sent before the worker's `voices` message arrives, just after it connects, is rejected. _(the agent's choice, 2026-11-16)_
- **One environment on Python 3.13 for every voice:** `chatterbox-tts` 0.1.7 resolves once torch is overridden to 2.11.0+cu128 (Chatterbox pins 2.6.0, which has no CUDA 12.8 build for the RTX 5090), and transformers stays at Chatterbox's 5.2.0, which CosyVoice runs on with the changes in [Voices](#voices). _(the agent's choice after the probe, 2026-11-16; CosyVoice 2026-11-17)_
- **The CUDA libraries from Python wheels, now torch's `nvidia-cublas-cu12` and `nvidia-cudnn-cu12`,** loaded by the worker before CTranslate2, so the PC needs only the NVIDIA driver (the agent's choice, 2026-11-15). torch 2.11+cu128 pins `nvidia-cudnn-cu12` 9.19, which conflicts with the 9.28 the worker pinned for CTranslate2, and CTranslate2 runs on torch's. `libnvblas` is not preloaded: with it, the worker crashed (exit 139) while loading the TTS models, right after NVBLAS announced itself, and the same run without it passed. torchcodec comes from PyTorch's CPU index because the PyPI build wants CUDA 13's `libnvrtc.so.13`. _(forced by the versions, 2026-11-16)_
