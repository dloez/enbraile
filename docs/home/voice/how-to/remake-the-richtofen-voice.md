# How to Remake the Richtofen Voice

The `richtofen` voice is Fun-CosyVoice3-0.5B with its language model and decoder fine-tuned on Richtofen's lines from the Castilian dub of Black Ops III Zombies, taken from the owner's own install. The scripts live outside the repository, in `~/voice-lab/` on the owner's PC, because they handle game audio; nothing they make goes into git ([why](../explanation/voice.md#decisions)).

## Prerequisites

- The owner's PC, with Black Ops III installed through Steam on Windows, so its Spanish sound banks are at `/mnt/c/Program Files (x86)/Steam/steamapps/common/Call of Duty Black Ops III/zone/snd/es/`.
- `~/voice-lab/cb/.venv` with `chatterbox-tts` and scikit-learn (Python 3.11, torch CUDA 12.8), for picking his clips, and the worker's environment in `home/voice/` (`uv sync`), for Whisper.
- `~/voice-lab/cosy/`: a uv project on Python 3.10 with torch and torchaudio 2.11.0 from PyTorch's CUDA 12.8 index (overriding CosyVoice's 2.3.1, which has no build for the RTX 5090), torchcodec 0.17.0 from the CPU index, CosyVoice's `requirements.txt` without deepspeed, and pandas. In it:
  - `CosyVoice/`, cloned with `--recursive` at the commit `COSYVOICE_COMMIT` in `home/voice/worker.py`, with two training fixes: in `cosyvoice/utils/train_utils.py`, `cosyvoice_join` returns `False` at once when `WORLD_SIZE` is 1 (its barrier needs an attribute torch 2.11 dropped), and in `cosyvoice/flow/flow.py`'s `forward`, the features, the upsampled tokens and the mask are cut to the shorter of the features and the tokens before the conditions are drawn (the clips' features ran one or two frames past twice the tokens, and the decoder's training stopped on it).
  - `stub/deepspeed/`, a stand-in package that only adds deepspeed's command-line arguments: CosyVoice's trainer imports deepspeed even with `torch_ddp`, and deepspeed fails to import without a CUDA toolkit.
  - `models/cv3/`, `FunAudioLLM/Fun-CosyVoice3-0.5B-2512` from Hugging Face.
- No other program using much of the GPU while it trains.

## Steps

1. Make the clips: `~/voice-lab/pipeline.sh` up to its dataset step. Each step prints `step … done`:
   - **carve:** splits each map's `zm_<map>.es.sabs` bank into its FLAC streams and decodes them to 24 kHz mono WAV under `clips/<map>/`.
   - **select:** embeds every clip with Chatterbox's voice encoder, clusters the Kino der Toten clips into five speakers, takes Richtofen's cluster and keeps the clips from every map close enough to it (`richtofen.json`).
   - **transcribe:** Whisper large-v3, from the worker's environment, writes each clip's text (`richtofen-text.json`).
   - **dataset:** keeps the clips Whisper was confident about, 1–11.5 s long, with a 5 % evaluation split (`xtts/data/`); the last run kept 2,166 clips, 119 minutes.
2. Clean them: `scripts/clean.py` then `scripts/dataset_clean.py` drop laughs and onomatopoeia, non-speech at the edges or in gaps over 1 s, clips two Whisper passes disagree on, low word confidence and odd speaking rates, into `xtts/data-clean/` (1,628 clips, 89 minutes last time).
3. Fine-tune: `~/voice-lab/cosy/train.sh` turns `data-clean` into CosyVoice's format (speaker embeddings, speech tokens, parquet) under `cosy/data/`, then trains the language model for 8 epochs at a learning rate of 1e-5 into `cosy/exp/llm/`; `MODELS=flow ./train.sh` does the same for the decoder into `cosy/exp/flow/`. Each takes about 25 s an epoch; `train.log` and `train-flow.log` print each epoch's held-out loss (`CV info … loss`).
4. Listen before replacing anything. `scripts/cosy_ckpt.py <out dir> models/cv3 llm.pt=exp/llm/epoch_<n>_whole.pt flow.pt=exp/flow/epoch_<m>_whole.pt` makes a model folder from chosen epochs, and `scripts/cosy_render.py <model dir> <tag> <out dir>` speaks six test lines with the worker's text preparation (`HOP` and `STEPS` set the first chunk and the decoder steps). Last time the language model's loss was lowest after epoch 1 and the owner chose epoch 2 by ear; the decoder's was lowest after epoch 5.
5. Make the bundle in `home/voice/data/richtofen-cosyvoice/`, real files rather than links: from the chosen model folder `cosyvoice3.yaml`, `config.json`, `configuration.json`, `hift.pt`, `campplus.onnx`, `speech_tokenizer_v3.onnx`, `flow.decoder.estimator.fp32.onnx`, `CosyVoice-BlankEN/`, `llm.pt` and `flow.pt`, plus `ref.wav`, a clean 5 s line of his from `xtts/data/wavs/`, and its words in `ref.txt`.
6. Restart the worker with `richtofen` in `VOICES`.
