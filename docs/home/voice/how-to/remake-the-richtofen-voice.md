# How to Remake the Richtofen Voice

The `richtofen` voice is XTTS-v2 fine-tuned on Richtofen's lines from the Castilian dub of Black Ops III Zombies, taken from the owner's own install. The scripts live outside the repository, in `~/voice-lab/` on the owner's PC (`pipeline.sh` and `scripts/`), because they handle game audio; nothing they make goes into git ([why](../explanation/voice.md#decisions)).

## Prerequisites

- The owner's PC, with Black Ops III installed through Steam on Windows, so its Spanish sound banks are at `/mnt/c/Program Files (x86)/Steam/steamapps/common/Call of Duty Black Ops III/zone/snd/es/`.
- `~/voice-lab/cb/.venv` with `chatterbox-tts` and scikit-learn, `~/voice-lab/xtts/.venv` with `coqui-tts` and its trainer, both Python 3.11 with torch CUDA 12.8 builds, and the worker's environment in `home/voice/` (`uv sync`).
- No other program using much of the GPU: the fine-tune takes most of it for tens of minutes.

## Steps

1. Run `~/voice-lab/pipeline.sh`. Each step prints `step … done`:
   - **carve:** splits each map's `zm_<map>.es.sabs` bank into its FLAC streams and decodes them to 24 kHz mono WAV under `clips/<map>/`.
   - **select:** embeds every clip with Chatterbox's voice encoder, clusters the Kino der Toten clips into five speakers, takes Richtofen's cluster and keeps the clips from every map close enough to it (`richtofen.json`).
   - **transcribe:** Whisper large-v3, from the worker's environment, writes each clip's text (`richtofen-text.json`).
   - **dataset:** keeps the clips Whisper was confident about, 1–11.5 s long, and writes a Coqui dataset with a 5 % evaluation split (`xtts/data/`); the last run kept 2,166 clips, 119 minutes.
   - **train:** fine-tunes XTTS-v2's GPT for 6 epochs (`scripts/train.py`, `scripts/gpt_train.py`) into `xtts/run/training/GPT_XTTS_FT-…/`, logging to `train.log`.
2. Listen before replacing anything: `scripts/render.py <checkpoint> <config.json> <vocab.json> <refs file> <lines.json> <out dir> <tag>` speaks test lines with the worker's settings. A further round of training plateaued and dropped words, so stop at the first.
3. Make the bundle in `~/voice-lab/models/richtofen/`: `model.pth` holding only the `model` entry of the run's `best_model.pth` (the trainer's optimizer, scheduler and other state dropped, 2 GB instead of 5.6 GB), the run's `config.json` with its training paths cleared, the base model's `vocab.json` (`xtts/run/training/XTTS_v2.0_original_model_files/`), and eight clean reference clips of him in `refs/`.
4. Copy the bundle into `home/voice/data/richtofen/` (or point `RICHTOFEN_DIR` at it) and restart the worker with `richtofen` in `VOICES`.
