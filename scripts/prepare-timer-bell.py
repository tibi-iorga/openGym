"""Turn the CC0 boxing-bell recording into an inlined timer cue.

Usage: python scripts/prepare-timer-bell.py path/to/1926.wav
The input is the original WAV from https://bigsoundbank.com/boxing-bell-1-s1926.html.
"""

import base64
import hashlib
import math
import sys
import wave
from pathlib import Path


EXPECTED_SHA256 = "8ccfe01d54ffd928dd1bbe5816302f26a73b81fbe02d22282e405282758d33b6"
RATE = 11025
DURATION = 0.94
TAPS = 24
OUTPUT = Path(__file__).resolve().parents[1] / "frontend/src/lib/tool-timer-bell.js"


def main(source):
    raw = source.read_bytes()
    if hashlib.sha256(raw).hexdigest() != EXPECTED_SHA256:
        raise ValueError("Input does not match the licensed source recording")
    with wave.open(str(source), "rb") as audio:
        if (audio.getnchannels(), audio.getsampwidth(), audio.getframerate()) != (1, 3, 48000):
            raise ValueError("Unexpected source audio format")
        frames = audio.readframes(audio.getnframes())

    source_samples = [
        int.from_bytes(frames[i:i + 3], "little", signed=True) / 8388608
        for i in range(0, len(frames), 3)
    ]
    cutoff = 0.92 * RATE / 2 / 48000
    converted = []
    for output_index in range(round(DURATION * RATE)):
        center = output_index * 48000 / RATE
        start = math.floor(center) - TAPS + 1
        total = weight_sum = 0.0
        for input_index in range(start, start + TAPS * 2):
            if not 0 <= input_index < len(source_samples):
                continue
            distance = input_index - center
            sinc = 1 if distance == 0 else math.sin(2 * math.pi * cutoff * distance) / (2 * math.pi * cutoff * distance)
            window = 0.5 + 0.5 * math.cos(math.pi * distance / TAPS)
            weight = 2 * cutoff * sinc * window
            total += source_samples[input_index] * weight
            weight_sum += weight
        fade = min(1, (DURATION - output_index / RATE) / 0.08)
        converted.append(total / weight_sum * max(0, fade))

    peak = max(abs(sample) for sample in converted)
    samples = bytes(max(1, min(255, round(128 + sample * 105 / peak))) for sample in converted)
    encoded = base64.b64encode(samples).decode("ascii")
    wrapped = "\n".join(f"  '{encoded[i:i + 100]}' +" for i in range(0, len(encoded), 100))
    wrapped = wrapped.removesuffix(" +")
    OUTPUT.write_text(
        "// Joseph Sardin, Boxing bell #1, CC0. See tool-timer-bell.md for source and processing.\n"
        "const encoded =\n" + wrapped + "\n"
        "export const RECORDED_BELL = Uint8Array.from(atob(encoded), value => value.charCodeAt(0))\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(samples)} samples to {OUTPUT}")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
