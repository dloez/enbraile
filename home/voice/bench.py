import argparse
import io
import subprocess
import threading
import time

import worker

LINES = [
    "Ach, por fin habéis llegado.",
    "Escuchad bien, porque no pienso repetirlo dos veces.",
    "La máquina necesita energía antes de que podáis usarla.",
    "Mirad con atención cada rincón de la sala, dummkopf.",
    "Wunderbar, eso es exactamente lo que esperaba de vosotros.",
]


def gpu_sampler(samples, stop):
    while not stop.is_set():
        out = subprocess.run(["nvidia-smi", "--query-gpu=utilization.gpu", "--format=csv,noheader,nounits"], capture_output=True, text=True).stdout.strip()
        if out.isdigit():
            samples.append(int(out))
        stop.wait(0.5)


def listening(model, clip, stop, counter):
    while not stop.is_set():
        segments, _ = model.transcribe(io.BytesIO(clip), language="es", vad_filter=True, beam_size=5)
        list(segments)
        counter[0] += 1


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--label", default="")
    parser.add_argument("--whisper", action="store_true")
    parser.add_argument("--rounds", type=int, default=2)
    args = parser.parse_args()

    started = time.time()
    engine = worker.Richtofen(None)
    print(f"richtofen loaded in {time.time() - started:.1f}s ({worker.RICHTOFEN_STEPS} steps)")
    stop = threading.Event()
    counter = [0]
    if args.whisper:
        model = worker.WhisperModel(worker.WHISPER_MODEL, device="cuda", compute_type="float16")
        clip = engine.wav(" ".join(LINES[:2]), None)
        threading.Thread(target=listening, args=(model, clip, stop, counter), daemon=True).start()
    samples = []
    threading.Thread(target=gpu_sampler, args=(samples, stop), daemon=True).start()

    rows = []
    for round_ in range(args.rounds):
        for line in LINES:
            begun = time.time()
            wav = engine.wav(line, None)
            made = time.time() - begun
            if round_:
                rows.append((made, worker.seconds(wav)))
    stop.set()
    made = sum(row[0] for row in rows)
    audio = sum(row[1] for row in rows)
    worst = max(row[0] / row[1] for row in rows)
    gpu = sum(samples) / len(samples) if samples else 0
    print(f"{args.label or 'run'}: {len(rows)} sentences, {made:.1f}s to make {audio:.1f}s of audio, {made / audio:.2f}x real time (worst {worst:.2f}x), mean {made / len(rows):.2f}s each, GPU {gpu:.0f}%{f', {counter[0]} transcriptions alongside' if args.whisper else ''}")


if __name__ == "__main__":
    main()
