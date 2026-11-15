import asyncio
import ctypes
import glob
import io
import json
import os
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
    for so in sorted(glob.glob(f"{lib_dir}/lib/*.so*")):
        try:
            ctypes.CDLL(so, mode=ctypes.RTLD_GLOBAL)
        except OSError:
            pass

import numpy as np  # noqa: E402
from faster_whisper import WhisperModel  # noqa: E402
from piper import PiperVoice  # noqa: E402
from websockets.asyncio.client import connect  # noqa: E402
from websockets.exceptions import ConnectionClosed  # noqa: E402

BOT_URL = os.environ["BOT_URL"].rstrip("/").replace("https://", "wss://").replace("http://", "ws://")
SECRET = os.environ["INTERNAL_SECRET"]
WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "large-v3")
LANGUAGE = os.environ.get("LANGUAGE", "es")
VOICE = os.environ.get("VOICE", "es_ES-davefx-medium")
DATA = Path(os.environ.get("DATA_DIR", Path(__file__).parent / "data"))
FOLLOW_UP_S = 8


def log(*parts):
    print(time.strftime("%H:%M:%S"), *parts, flush=True)


def plain(word):
    return re.sub(r"[^a-z]", "", unicodedata.normalize("NFD", word.lower()).encode("ascii", "ignore").decode())


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


def frame(header, body):
    head = json.dumps(header).encode()
    return struct.pack(">I", len(head)) + head + body


def unframe(data):
    size = struct.unpack(">I", data[:4])[0]
    return json.loads(data[4 : 4 + size]), data[4 + size :]


class Worker:
    def __init__(self):
        DATA.mkdir(parents=True, exist_ok=True)
        model_path = DATA / f"{VOICE}.onnx"
        if not model_path.exists():
            subprocess.run([sys.executable, "-m", "piper.download_voices", "--data-dir", str(DATA), VOICE], check=True)
        started = time.time()
        self.whisper = WhisperModel(WHISPER_MODEL, device="cuda", compute_type="float16")
        list(self.whisper.transcribe(np.random.uniform(-0.1, 0.1, 16000 * 3).astype(np.float32), language=LANGUAGE)[0])
        self.voice = PiperVoice.load(str(model_path))
        self.chime = chime()
        self.pending = {}
        self.triggers = {}
        log(f"ready: {WHISPER_MODEL} and {VOICE} loaded in {time.time() - started:.1f}s")

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
            if plain(spoken) in self.triggers:
                rest = " ".join(words[index + 1 :]).strip(" ,.;:¿?¡!")
                if len(plain(rest)) < 2:
                    self.pending[user] = (plain(spoken), now)
                    return plain(spoken), None
                return plain(spoken), rest
        return None, None

    def speak(self, text):
        buffer = io.BytesIO()
        with wave.open(buffer, "wb") as file:
            self.voice.synthesize_wav(text, file)
        return opus(buffer.getvalue())

    async def serve(self):
        async for socket in connect(f"{BOT_URL}/voice/connect", additional_headers={"Authorization": f"Bearer {SECRET}"}, max_size=None):
            log("connected to", BOT_URL)
            try:
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
                        elif data.get("type") == "say":
                            audio = await asyncio.to_thread(self.speak, data["text"])
                            await socket.send(frame({"type": "audio", "id": data["id"]}, audio))
            except ConnectionClosed:
                log("disconnected, reconnecting")

    async def on_clip(self, socket, user, clip, spoken_at):
        started = time.time()
        text, duration = await asyncio.to_thread(self.transcribe, clip)
        if not text:
            return
        await socket.send(json.dumps({"type": "transcript", "user": user, "text": text, "at": spoken_at, "ms": round(duration * 1000)}))
        word, request = self.trigger(user, text)
        if word and request is None and self.triggers.get(word):
            await socket.send(frame({"type": "audio", "id": "ack"}, self.chime))
        if word and request is not None:
            if self.triggers.get(word) and request != text:
                await socket.send(frame({"type": "audio", "id": "ack"}, self.chime))
            log(f"trigger {word} {user} ({time.time() - started:.2f}s): {request}")
            await socket.send(json.dumps({"type": "trigger", "word": word, "user": user, "text": request}))


if __name__ == "__main__":
    asyncio.run(Worker().serve())
