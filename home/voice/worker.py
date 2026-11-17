import asyncio
import ctypes
import gc
import glob
import io
import json
import os
import random
import re
import struct
import subprocess
import sys
import time
import unicodedata
import wave
from pathlib import Path

import nvidia.cublas
import nvidia.cudnn

for lib_dir in (nvidia.cublas.__path__[0], nvidia.cudnn.__path__[0]):
    for so in sorted(set(glob.glob(f"{lib_dir}/lib/*.so*")) - set(glob.glob(f"{lib_dir}/lib/libnvblas*"))):
        try:
            ctypes.CDLL(so, mode=ctypes.RTLD_GLOBAL)
        except OSError:
            pass

import numpy as np  # noqa: E402
import soundfile as sf  # noqa: E402
from faster_whisper import WhisperModel  # noqa: E402
from websockets.asyncio.client import connect  # noqa: E402
from websockets.exceptions import ConnectionClosed  # noqa: E402

BOT_URL = os.environ["BOT_URL"].rstrip("/").replace("https://", "wss://").replace("http://", "ws://")
SECRET = os.environ["INTERNAL_SECRET"]
WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "large-v3")
LANGUAGE = os.environ.get("LANGUAGE", "es")
PIPER_VOICE = os.environ.get("PIPER_VOICE", "es_ES-davefx-medium")
DATA = Path(os.environ.get("DATA_DIR", Path(__file__).parent / "data"))
RICHTOFEN_DIR = Path(os.environ.get("RICHTOFEN_DIR", DATA / "richtofen"))
VOICES = [name.strip() for name in os.environ.get("VOICES", "piper").split(",") if name.strip()]
DEFAULT_VOICE = os.environ.get("DEFAULT_VOICE", VOICES[0] if VOICES else "")
WARM_VOICES = [name.strip() for name in os.environ.get("WARM_VOICES", DEFAULT_VOICE).split(",") if name.strip()]
LOAD_WAIT_S = float(os.environ.get("LOAD_WAIT_S", "30"))
FOLLOW_UP_S = 8
CHATTERBOX_PRESETS = {"chatterbox": (0.5, 0.5), "chatterbox-expressive": (0.8, 0.3)}
CHATTERBOX_BASE = ("ResembleAI/chatterbox", ["ve.pt", "conds.pt", "s3gen.pt", "Cangjie5_TC.json"])
CHATTERBOX_SPAIN = ("ResembleAI/Chatterbox-Multilingual-es-es", ["t3_es_es.safetensors", "grapheme_mtl_merged_expanded_v1.json"])
SENTENCE = re.compile(r"(?<=[.!?…])\s+")
GAP_S = 0.15
RICHTOFEN_HEARD = 0.8
RICHTOFEN_CHECKED_WORDS = 3
RICHTOFEN_TRIES = 3
RICHTOFEN_STREAM_WORDS = int(os.environ.get("RICHTOFEN_STREAM_WORDS", "0"))
STREAM_GAP_S = 0.15


def log(*parts):
    print(time.strftime("%H:%M:%S"), *parts, flush=True)


def plain(word):
    return re.sub(r"[^a-z]", "", unicodedata.normalize("NFD", word.lower()).encode("ascii", "ignore").decode())


def sound(word):
    word = plain(word).replace("th", "t").replace("k", "c").replace("y", "i")
    return re.sub(r"(.)\1+", r"\1", word)


def distance(a, b):
    row = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        prev, row[0] = row[0], i
        for j, y in enumerate(b, 1):
            prev, row[j] = row[j], min(row[j] + 1, row[j - 1] + 1, prev + (x != y))
    return row[-1]


def wake(spoken, triggers):
    heard = sound(spoken)
    if not heard:
        return None
    for word in triggers:
        target = sound(word)
        allowed = 0 if len(target) < 6 else 1 if len(target) < 9 else 2
        if heard == target or (allowed and distance(heard, target) <= allowed):
            return word
    return None


def opus(wav_bytes):
    return subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", "pipe:0", "-ac", "2", "-ar", "48000", "-c:a", "libopus", "-b:a", "96k", "-f", "ogg", "pipe:1"],
        input=wav_bytes,
        capture_output=True,
        check=True,
    ).stdout


def chime():
    wav = subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=880:duration=0.12", "-f", "lavfi", "-i", "sine=frequency=1320:duration=0.18",
         "-filter_complex", "[0][1]concat=n=2:v=0:a=1,afade=t=out:st=0.22:d=0.08,volume=0.5", "-ar", "48000", "-f", "wav", "pipe:1"],
        capture_output=True,
        check=True,
    ).stdout
    return opus(wav)


def sentences(text):
    return [part.strip() for part in SENTENCE.split(text.strip()) if part.strip()]


def wav_bytes(samples, rate):
    buffer = io.BytesIO()
    sf.write(buffer, samples, rate, format="WAV")
    return buffer.getvalue()


def joined(parts, rate):
    gap = np.zeros(int(rate * GAP_S), dtype=np.float32)
    pieces = []
    for part in parts:
        pieces += [np.asarray(part, dtype=np.float32).reshape(-1), gap]
    return np.concatenate(pieces[:-1]) if pieces else gap


def heard_share(whisper, wav, text):
    segments, _ = whisper.transcribe(io.BytesIO(wav), language=LANGUAGE, beam_size=5)
    heard = {plain(word) for segment in segments for word in segment.text.split()}
    words = [plain(word) for word in text.split() if plain(word)]
    return sum(word in heard for word in words) / max(len(words), 1)


class Piper:
    def __init__(self, whisper):
        from piper import PiperVoice

        model_path = DATA / f"{PIPER_VOICE}.onnx"
        if not model_path.exists():
            subprocess.run([sys.executable, "-m", "piper.download_voices", "--data-dir", str(DATA), PIPER_VOICE], check=True)
        self.voice = PiperVoice.load(str(model_path))

    def wav(self, text, preset):
        buffer = io.BytesIO()
        with wave.open(buffer, "wb") as file:
            self.voice.synthesize_wav(text, file)
        return buffer.getvalue()


class Chatterbox:
    def __init__(self, whisper):
        from chatterbox.mtl_tts import ChatterboxMultilingualTTS
        from huggingface_hub import hf_hub_download

        folder = DATA / "chatterbox-es"
        folder.mkdir(parents=True, exist_ok=True)
        for repo, names in (CHATTERBOX_BASE, CHATTERBOX_SPAIN):
            for name in names:
                target = folder / ("t3_mtl23ls_v2.safetensors" if name == "t3_es_es.safetensors" else name)
                if not target.exists():
                    target.unlink(missing_ok=True)
                    target.symlink_to(hf_hub_download(repo, name))
        self.model = ChatterboxMultilingualTTS.from_local(folder, "cuda")
        self.wav("Hola.", CHATTERBOX_PRESETS["chatterbox"])

    def wav(self, text, preset):
        exaggeration, cfg_weight = preset
        parts = [self.model.generate(sentence, language_id="es", exaggeration=exaggeration, cfg_weight=cfg_weight).squeeze(0).numpy() for sentence in sentences(text)]
        return wav_bytes(joined(parts, self.model.sr), self.model.sr)


class Richtofen:
    def __init__(self, whisper):
        self.whisper = whisper
        from TTS.tts.configs.xtts_config import XttsConfig
        from TTS.tts.models.xtts import Xtts

        config = XttsConfig()
        config.load_json(str(RICHTOFEN_DIR / "config.json"))
        self.model = Xtts.init_from_config(config)
        self.model.load_checkpoint(config, checkpoint_path=str(RICHTOFEN_DIR / "model.pth"), vocab_path=str(RICHTOFEN_DIR / "vocab.json"), use_deepspeed=False)
        self.model.cuda()
        refs = [str(path) for path in sorted((RICHTOFEN_DIR / "refs").glob("*.wav"))]
        self.latents, self.speaker = self.model.get_conditioning_latents(audio_path=refs, gpt_cond_len=30, max_ref_length=60)
        self.wav("Hola.", None)

    def sentence(self, text):
        best, best_share = None, -1.0
        for _ in range(RICHTOFEN_TRIES):
            samples = self.model.inference(text, "es", self.latents, self.speaker, temperature=0.65, top_p=0.85, top_k=50, repetition_penalty=5.0)["wav"]
            if len(text.split()) < RICHTOFEN_CHECKED_WORDS:
                return samples
            share = heard_share(self.whisper, wav_bytes(samples, 24000), text)
            if share > best_share:
                best, best_share = samples, share
            if share >= RICHTOFEN_HEARD:
                break
            log(f"richtofen said {share:.0%} of: {text}")
        return best

    def wav(self, text, preset):
        return wav_bytes(joined([self.sentence(part) for part in sentences(text)], 24000), 24000)

    def streams(self, text):
        return RICHTOFEN_STREAM_WORDS > 0 and all(len(part.split()) <= RICHTOFEN_STREAM_WORDS for part in sentences(text))

    def stream(self, text):
        for index, part in enumerate(sentences(text)):
            if index:
                yield np.zeros(int(24000 * STREAM_GAP_S), dtype=np.float32)
            for chunk in self.model.inference_stream(part, "es", self.latents, self.speaker, stream_chunk_size=20, temperature=0.65, top_p=0.85, top_k=50, repetition_penalty=5.0, enable_text_splitting=False):
                yield chunk.detach().float().cpu().numpy().reshape(-1)


ENGINES = {"piper": (Piper, None), "richtofen": (Richtofen, None)} | {name: (Chatterbox, preset) for name, preset in CHATTERBOX_PRESETS.items()}


def frame(header, body):
    head = json.dumps(header).encode()
    return struct.pack(">I", len(head)) + head + body


def unframe(data):
    size = struct.unpack(">I", data[:4])[0]
    return json.loads(data[4 : 4 + size]), data[4 + size :]


class Worker:
    def __init__(self):
        unknown = [name for name in VOICES + WARM_VOICES if name not in ENGINES]
        if unknown or not VOICES:
            raise SystemExit(f"VOICES must name one or more of {', '.join(ENGINES)}; unknown: {', '.join(unknown) or 'none given'}")
        if DEFAULT_VOICE not in VOICES:
            raise SystemExit(f"DEFAULT_VOICE {DEFAULT_VOICE} is not in VOICES")
        outside = [name for name in WARM_VOICES if name not in VOICES]
        if outside:
            raise SystemExit(f"WARM_VOICES {', '.join(outside)} not in VOICES")
        DATA.mkdir(parents=True, exist_ok=True)
        started = time.time()
        self.whisper = WhisperModel(WHISPER_MODEL, device="cuda", compute_type="float16")
        list(self.whisper.transcribe(np.random.uniform(-0.1, 0.1, 16000 * 3).astype(np.float32), language=LANGUAGE)[0])
        self.engines = {}
        self.broken = set()
        self.wanted = set()
        for kind in self.kinds(WARM_VOICES):
            self.load(kind)
        self.chime = chime()
        self.clips = {}
        self.preparing = asyncio.Lock()
        self.last_ack = {}
        self.pending = {}
        self.triggers = {}
        self.socket = None
        self.turn = asyncio.Lock()
        self.using = asyncio.Lock()
        self.changed = asyncio.Condition()
        self.wake = asyncio.Event()
        log(f"ready: {WHISPER_MODEL}, voices {', '.join(VOICES)} (default {DEFAULT_VOICE}), loaded {', '.join(self.loaded()) or 'none'} in {time.time() - started:.1f}s")

    @staticmethod
    def kinds(names):
        return list(dict.fromkeys(ENGINES[name][0] for name in names))

    def loaded(self):
        return [name for name in VOICES if ENGINES[name][0] in self.engines]

    def target(self):
        return [name for name in VOICES if name in self.wanted or name in WARM_VOICES]

    def loading(self, name):
        kind = ENGINES[name][0]
        return name in self.target() and kind not in self.engines and kind not in self.broken

    def load(self, kind):
        started = time.time()
        try:
            self.engines[kind] = kind(self.whisper)
        except Exception as error:
            self.broken.add(kind)
            log(f"{kind.__name__.lower()} failed to load: {error}")
            self.free()
            return
        log(f"{kind.__name__.lower()} loaded in {time.time() - started:.1f}s")

    def unload(self, kind):
        del self.engines[kind]
        self.free()
        log(f"{kind.__name__.lower()} unloaded")

    @staticmethod
    def free():
        gc.collect()
        import torch

        if torch.cuda.is_available():
            torch.cuda.empty_cache()

    def ack(self, word):
        spec = self.triggers.get(word)
        if not isinstance(spec, dict):
            return self.chime
        ready = [line for line in spec["lines"] if (spec["voice"], line) in self.clips]
        if not ready:
            return self.chime
        fresh = [line for line in ready if line != self.last_ack.get(word)] or ready
        line = random.choice(fresh)
        self.last_ack[word] = line
        return self.clips[(spec["voice"], line)]

    async def prepare_acks(self):
        async with self.preparing:
            await self.make_acks()

    async def make_acks(self):
        for spec in list(self.triggers.values()):
            if not isinstance(spec, dict) or spec.get("voice") not in self.loaded():
                continue
            for line in spec.get("lines", []):
                key = (spec["voice"], line)
                if key in self.clips:
                    continue
                async with self.turn:
                    async with self.using:
                        if spec["voice"] not in self.loaded():
                            break
                        try:
                            self.clips[key] = await asyncio.to_thread(self.speak, line, spec["voice"])
                        except Exception as error:
                            log(f"ack in {spec['voice']} failed: {error}")
                            break
            if any((spec["voice"], line) in self.clips for line in spec.get("lines", [])):
                log(f"acks ready in {spec['voice']}: {sum((spec['voice'], line) in self.clips for line in spec['lines'])}")

    async def announce(self):
        asyncio.create_task(self.prepare_acks())
        if self.socket:
            try:
                await self.socket.send(json.dumps({"type": "voices", "voices": VOICES, "default": DEFAULT_VOICE, "loaded": self.loaded()}))
            except ConnectionClosed:
                pass
        async with self.changed:
            self.changed.notify_all()

    async def reconcile(self):
        while True:
            await self.wake.wait()
            self.wake.clear()
            needed = self.kinds(self.target())
            for kind in [kind for kind in self.engines if kind not in needed]:
                async with self.using:
                    if kind not in self.kinds(self.target()):
                        self.unload(kind)
                await self.announce()
            for kind in needed:
                if self.wake.is_set():
                    break
                if kind not in self.engines and kind not in self.broken:
                    await asyncio.to_thread(self.load, kind)
                    await self.announce()

    async def want(self, names):
        unknown = [name for name in names if name not in VOICES]
        if unknown:
            log("asked for voices it may not load:", ", ".join(unknown))
        wanted = {name for name in names if name in VOICES}
        if wanted != self.wanted:
            log("wanted voices", ", ".join(sorted(wanted)) or "none")
        self.wanted = wanted
        self.broken.clear()
        self.wake.set()
        async with self.changed:
            self.changed.notify_all()

    async def voice_for(self, name):
        try:
            async with asyncio.timeout(LOAD_WAIT_S):
                async with self.changed:
                    await self.changed.wait_for(lambda: name in self.loaded() or not self.loading(name))
        except TimeoutError:
            pass
        if name in self.loaded():
            return name
        loaded = self.loaded()
        fallback = DEFAULT_VOICE if DEFAULT_VOICE in loaded else (loaded[0] if loaded else None)
        reason = f"still loading after {LOAD_WAIT_S:.0f}s" if self.loading(name) else "not loaded"
        log(f"voice {name} {reason}, speaking with {fallback or 'nothing'}")
        return fallback

    def transcribe(self, clip):
        hotwords = " ".join(self.triggers) or None
        segments, info = self.whisper.transcribe(io.BytesIO(clip), language=LANGUAGE, vad_filter=True, beam_size=5, hotwords=hotwords)
        return " ".join(segment.text.strip() for segment in segments).strip(), info.duration

    def trigger(self, user, text):
        words = text.split()
        now = time.time()
        word, at = self.pending.pop(user, (None, 0))
        if word and now - at < FOLLOW_UP_S and words:
            return word, text
        for index, spoken in enumerate(words):
            matched = wake(spoken, self.triggers)
            if matched:
                rest = " ".join(words[index + 1 :]).lstrip(" ,.;:")
                if len(plain(rest)) < 2:
                    self.pending[user] = (matched, now)
                    return matched, None
                return matched, rest
        return None, None

    def speak(self, text, name):
        kind, preset = ENGINES[name]
        return opus(self.engines[kind].wav(text, preset))

    async def stream_say(self, socket, id, engine, text):
        loop = asyncio.get_running_loop()
        queue = asyncio.Queue()
        encoder = subprocess.Popen(
            ["ffmpeg", "-hide_banner", "-loglevel", "error", "-f", "f32le", "-ar", "24000", "-ac", "1", "-i", "pipe:0", "-ac", "2", "-ar", "48000", "-c:a", "libopus", "-b:a", "96k", "-page_duration", "20000", "-flush_packets", "1", "-f", "ogg", "pipe:1"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
        )

        def produce():
            try:
                for chunk in engine.stream(text):
                    encoder.stdin.write(chunk.astype(np.float32).tobytes())
                    encoder.stdin.flush()
            finally:
                encoder.stdin.close()

        def drain():
            while True:
                data = encoder.stdout.read1(16384)
                loop.call_soon_threadsafe(queue.put_nowait, data)
                if not data:
                    return

        started = time.time()
        producing = asyncio.create_task(asyncio.to_thread(produce))
        draining = asyncio.create_task(asyncio.to_thread(drain))
        first = None
        while True:
            data = await queue.get()
            if not data:
                break
            if first is None:
                first = time.time() - started
            await socket.send(frame({"type": "audio", "id": id, "stream": True}, data))
        await draining
        try:
            await producing
        finally:
            encoder.wait()
        await socket.send(frame({"type": "audio", "id": id, "stream": True, "end": True}, b""))
        log(f"streamed in {time.time() - started:.2f}s, first audio after {first or 0:.2f}s")

    async def on_say(self, socket, id, text, voice):
        async with self.turn:
            name = voice if voice in VOICES else DEFAULT_VOICE
            if name not in self.loaded():
                name = await self.voice_for(name)
            async with self.using:
                if name not in self.loaded():
                    await socket.send(json.dumps({"type": "failed", "id": id, "error": "no voice is loaded"}))
                    return
                engine = self.engines[ENGINES[name][0]]
                if hasattr(engine, "streams") and engine.streams(text):
                    try:
                        await self.stream_say(socket, id, engine, text)
                    except Exception as error:
                        log(f"stream in {name} failed: {error}")
                        await socket.send(json.dumps({"type": "failed", "id": id, "error": f"{name} could not speak"}))
                    return
                try:
                    audio = await asyncio.to_thread(self.speak, text, name)
                except Exception as error:
                    log(f"say in {name} failed: {error}")
                    await socket.send(json.dumps({"type": "failed", "id": id, "error": f"{name} could not speak"}))
                    return
            await socket.send(frame({"type": "audio", "id": id}, audio))

    async def serve(self):
        asyncio.create_task(self.reconcile())
        async for socket in connect(f"{BOT_URL}/voice/connect", additional_headers={"Authorization": f"Bearer {SECRET}"}, max_size=None):
            log("connected to", BOT_URL)
            self.socket = socket
            try:
                await self.announce()
                async for message in socket:
                    if isinstance(message, bytes):
                        header, body = unframe(message)
                        if header.get("type") == "clip":
                            await self.on_clip(socket, header["user"], body, header.get("at"))
                    else:
                        data = json.loads(message)
                        if data.get("type") == "triggers":
                            self.triggers = {entry["word"]: entry["ack"] for entry in data["words"]}
                            log("triggers", ", ".join(self.triggers) or "none")
                            asyncio.create_task(self.prepare_acks())
                        elif data.get("type") == "want":
                            await self.want(data["voices"])
                        elif data.get("type") == "say":
                            asyncio.create_task(self.on_say(socket, data["id"], data["text"], data.get("voice")))
            except ConnectionClosed:
                log("disconnected, reconnecting")

    async def on_clip(self, socket, user, clip, spoken_at):
        started = time.time()
        text, duration = await asyncio.to_thread(self.transcribe, clip)
        await socket.send(json.dumps({"type": "transcript", "user": user, "text": text, "at": spoken_at, "ms": round(duration * 1000)}))
        if not text:
            return
        word, request = self.trigger(user, text)
        if word and request is None and self.triggers.get(word):
            await socket.send(frame({"type": "audio", "id": "ack"}, self.ack(word)))
        if word and request is not None:
            if self.triggers.get(word) and request != text:
                await socket.send(frame({"type": "audio", "id": "ack"}, self.ack(word)))
            log(f"trigger {word} {user} ({time.time() - started:.2f}s): {request}")
            await socket.send(json.dumps({"type": "trigger", "word": word, "user": user, "text": request}))


if __name__ == "__main__":
    asyncio.run(Worker().serve())
