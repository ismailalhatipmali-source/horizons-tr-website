#!/usr/bin/env python3
"""Split the approved foundation master into 168 ordered, padded MP3 clips.

The source is never modified. Silence locates candidate boundaries; it does
not establish pronunciation correctness. That approval belongs to the Arabic
listener. Reproducible source ranges and hashes accompany every exported clip.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import tempfile
import wave


LETTERS = (
    ("alif", "ا", "ألف"),
    ("baa", "ب", "باء"),
    ("taa", "ت", "تاء"),
    ("thaa", "ث", "ثاء"),
    ("jiim", "ج", "جيم"),
    ("haa", "ح", "حاء"),
    ("khaa", "خ", "خاء"),
    ("daal", "د", "دال"),
    ("dhaal", "ذ", "ذال"),
    ("raa", "ر", "راء"),
    ("zaay", "ز", "زاي"),
    ("siin", "س", "سين"),
    ("shiin", "ش", "شين"),
    ("saad", "ص", "صاد"),
    ("daad", "ض", "ضاد"),
    ("taa_emphatic", "ط", "طاء"),
    ("dhaa_emphatic", "ظ", "ظاء"),
    ("ayn", "ع", "عين"),
    ("ghayn", "غ", "غين"),
    ("faa", "ف", "فاء"),
    ("qaaf", "ق", "قاف"),
    ("kaaf", "ك", "كاف"),
    ("laam", "ل", "لام"),
    ("miim", "م", "ميم"),
    ("nuun", "ن", "نون"),
    ("haa_breath", "ه", "هاء"),
    ("waaw", "و", "واو"),
    ("yaa", "ي", "ياء"),
)
VOWELS = (("fatha", "َ", "ا"), ("damma", "ُ", "و"), ("kasra", "ِ", "ي"))


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def detect_gaps(source: Path, threshold: int, source_duration: float) -> list[tuple[float, float]]:
    result = subprocess.run(
        ["ffmpeg", "-hide_banner", "-i", str(source), "-af",
         f"silencedetect=noise={threshold}dB:d=0.35", "-f", "null", "-"],
        capture_output=True, text=True, check=True,
    )
    starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", result.stderr)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", result.stderr)]
    if len(starts) != len(ends):
        raise ValueError(f"Unpaired silence boundaries at {threshold}dB")
    gaps = list(zip(starts, ends))
    if len(gaps) != 168:
        raise ValueError(f"Expected 168 silence gaps; found {len(gaps)} at {threshold}dB")
    # The final gap is the trailing pause, rather than another utterance.
    if not gaps or gaps[0][0] <= 0 or abs(gaps[-1][1] - source_duration) > 0.01:
        raise ValueError("Unexpected leading silence or absent trailing silence")
    if any(end <= start for start, end in gaps):
        raise ValueError("Invalid silence duration")
    return gaps


def target_items() -> list[dict]:
    result = []
    for key, letter, name in LETTERS:
        for vowel, mark, madd in VOWELS:
            short = letter + mark
            long = short + madd
            if key == "alif":
                short, long = {
                    "fatha": ("أَ", "آ"),
                    "damma": ("أُ", "أُو"),
                    "kasra": ("إِ", "إِي"),
                }[vowel]
            for length, text in (("short", short), ("long", long)):
                asset_id = f"phonics.{key}.{vowel}.{length}"
                result.append({
                    "id": asset_id,
                    "order": len(result) + 1,
                    "letter_id": key,
                    "letter": letter,
                    "letter_name": name,
                    "vowel": vowel,
                    "length": length,
                    "text": text,
                    "text_sha256": digest(text.encode("utf-8")),
                    "path": f"audio/{asset_id}.mp3",
                    "course_path": f"course/audio/female-final/{asset_id}.mp3",
                })
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--padding-before", type=float, default=0.150)
    parser.add_argument("--padding-after", type=float, default=0.200)
    args = parser.parse_args()
    if not 0 <= args.padding_before <= 0.3 or not 0 <= args.padding_after <= 0.3:
        raise ValueError("Padding must be between 0 and 300ms")
    source = args.source.resolve(strict=True)
    source_sha = digest(source.read_bytes())
    with wave.open(str(source), "rb") as reader:
        if reader.getsampwidth() != 2 or reader.getnchannels() != 1:
            raise ValueError("Expected the approved mono PCM16 master")
        sample_rate = reader.getframerate()
        frames = reader.getnframes()
        pcm = reader.readframes(frames)
    duration = frames / sample_rate
    checks = {}
    # A wide threshold range must retain the same order and count. If it does
    # not, refuse the export rather than silently shifting all subsequent IDs.
    for threshold in (-30, -32, -35, -38, -40, -42, -45):
        checks[threshold] = detect_gaps(source, threshold, duration)
    gaps = checks[-45]
    for threshold, candidate in checks.items():
        boundary_shift = max(
            abs(a - b)
            for current, reference in zip(candidate, gaps)
            for a, b in zip(current, reference)
        )
        if boundary_shift > 0.160:
            raise ValueError(f"Boundary instability {boundary_shift:.3f}s at {threshold}dB")
    items = target_items()
    audio_dir = args.output / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)
    active_durations = []
    for index, (gap_start, _) in enumerate(gaps):
        speech_start = 0.0 if index == 0 else gaps[index - 1][1]
        speech_end = gap_start
        previous_midpoint = 0.0 if index == 0 else sum(gaps[index - 1]) / 2
        next_midpoint = sum(gaps[index]) / 2
        start = max(previous_midpoint, speech_start - args.padding_before)
        end = min(next_midpoint, speech_end + args.padding_after)
        start_frame = max(0, round(start * sample_rate))
        end_frame = min(frames, round(end * sample_rate))
        if speech_end - speech_start < 0.1 or end_frame <= start_frame:
            raise ValueError(f"Invalid utterance {index + 1}")
        audio_pcm = pcm[start_frame * 2:end_frame * 2]
        item = items[index]
        final_path = args.output / item["path"]
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as temp:
            temporary_path = Path(temp.name)
        try:
            subprocess.run(
                ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                 "-f", "s16le", "-ar", str(sample_rate), "-ac", "1", "-i", "pipe:0",
                 "-map_metadata", "-1", "-c:a", "libmp3lame", "-b:a", "96k",
                 str(temporary_path)], input=audio_pcm, check=True,
            )
            temporary_path.replace(final_path)
        finally:
            temporary_path.unlink(missing_ok=True)
        item.update({
            "source_speech_start_seconds": round(speech_start, 6),
            "source_speech_end_seconds": round(speech_end, 6),
            "source_start_frame": start_frame,
            "source_end_frame": end_frame,
            "source_start_seconds": round(start_frame / sample_rate, 6),
            "source_end_seconds": round(end_frame / sample_rate, 6),
            "duration_seconds": round((end_frame - start_frame) / sample_rate, 6),
            "mime": "audio/mpeg",
            "bytes": final_path.stat().st_size,
            "sha256": digest(final_path.read_bytes()),
        })
        active_durations.append(speech_end - speech_start)
    unexpected_files = set(audio_dir.glob("*.mp3")) - {args.output / x["path"] for x in items}
    if unexpected_files:
        raise ValueError("Unexpected MP3s in output; refusing ambiguous manifest")
    manifest = {
        "schema": "horizons-phonics-audio-1",
        "voice": "Erinome",
        "pronunciation_approval": "user-confirmed; not established by silence analysis",
        "source": {
            "filename": source.name,
            "sha256": source_sha,
            "codec": "pcm_s16le",
            "sample_rate": sample_rate,
            "channels": 1,
            "frames": frames,
            "duration_seconds": round(duration, 6),
        },
        "split": {
            "noise_threshold_db": -45,
            "minimum_silence_seconds": 0.35,
            "padding_before_seconds": args.padding_before,
            "padding_after_seconds": args.padding_after,
            "threshold_sensitivity": [
                {"noise_threshold_db": threshold, "utterances": len(boundaries)}
                for threshold, boundaries in checks.items()
            ],
            "longer_than_short_whole_span_pairs": sum(
                active_durations[i + 1] > active_durations[i]
                for i in range(0, len(items), 2)
            ),
            "note": "Whole-span timing is a technical check, not a vowel-duration or pronunciation assessment.",
        },
        "items": items,
    }
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / "audio-manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    # The master must still be byte-for-byte intact after the operation.
    if digest(source.read_bytes()) != source_sha:
        raise ValueError("Source master changed")
    print(json.dumps({"clips": len(items), "source_seconds": duration,
                      "source_sha256": source_sha,
                      "mp3_bytes": sum(x["bytes"] for x in items)}, indent=2))


if __name__ == "__main__":
    main()
