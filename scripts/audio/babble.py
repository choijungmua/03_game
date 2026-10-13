"""동물의 숲식 카피바라 중얼거림 목소리를 만든다.

대사의 음절마다 Heami(여자) 음성으로 녹음한 소리의 앞부분만 잘라, 높고 빠르게 이어 붙인다.
알아듣는 말이 아니라 귀여운 "뾰로롱" 소리가 나고, 뜻은 게임 화면 글자가 전한다.
감정마다 음높이 곡선이 다르다: 기쁨은 끝이 올라가고, 아쉬움은 내려가고, 졸림은 낮고 느리다.

사용: python scripts/audio/babble.py <음절 녹음 폴더> <출력 폴더>
      (음절 녹음이 없으면 syllables.ps1을 불러 먼저 녹음한다)
"""

import subprocess
import sys
from fractions import Fraction
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, resample_poly, sosfilt

OUT_RATE = 24000

# 대사 → (글, 감정)
LINES = {
    "three": ("셋", "neutral"), "two": ("둘", "neutral"), "one": ("하나", "neutral"), "go": ("시작", "happy"),
    "win": ("이겼다", "happy"), "lose": ("아이고", "sad"), "record": ("신기록", "happy"), "nice": ("좋아", "happy"),
    "wow": ("대박", "happy"), "great": ("나이스", "happy"), "oops": ("앗", "surprise"), "ouch": ("아야", "surprise"),
    "myturn": ("내차례", "neutral"), "timeup": ("끝", "neutral"), "woah": ("우와", "surprise"), "careful": ("조심해", "neutral"),
    "hup": ("얍", "surprise"), "hurry": ("서둘러", "neutral"), "yawn": ("하아암", "sleepy"), "yum": ("냠냠", "happy"),
    "hi": ("안녕", "happy"), "gotit": ("잡았다", "happy"), "ahh": ("아시원해", "sleepy"), "levelup": ("레벨업", "happy"),
    "yay": ("야호", "happy"),
}

# 감정 → (기본 음높이 배수, 마지막 음절까지 바뀌는 배수, 음절 길이 ms)
MOODS = {
    "happy": (1.75, 1.18, 85),
    "neutral": (1.7, 1.0, 85),
    "surprise": (1.85, 1.1, 90),
    "sad": (1.5, 0.78, 110),
    "sleepy": (1.35, 0.85, 150),
}
GAP_MS = 14


def load(path: Path) -> tuple[np.ndarray, int]:
    rate, data = wavfile.read(path)
    x = data.astype(np.float64)
    x /= np.abs(x).max() or 1
    env = np.convolve(np.abs(x), np.ones(rate // 100) / (rate // 100), mode="same")
    loud = np.where(env > env.max() * 0.05)[0]
    return x[loud[0]: loud[-1]], rate


def grain(path: Path, pitch: float, length_ms: int) -> np.ndarray:
    x, rate = load(path)
    # 음절 앞부분(자음+모음)만 쓰고 끝은 부드럽게 줄인다 — 짧게 끊어야 말이 아니라 중얼거림이 된다
    x = x[: int(rate * length_ms / 1000 * pitch)]
    fade = min(len(x) // 3, int(rate * 0.025))
    x[-fade:] *= np.linspace(1, 0, fade)
    x[: int(rate * 0.003)] *= np.linspace(0, 1, int(rate * 0.003))
    # 비율을 작은 분수로 줄여야 빠르다 (그대로 두면 필터가 수백만 탭이 되어 멈춘 듯 느려진다)
    ratio = Fraction(OUT_RATE, rate) / Fraction(pitch).limit_denominator(200)
    ratio = ratio.limit_denominator(400)
    return resample_poly(x, ratio.numerator, ratio.denominator)


def babble(text: str, mood: str, syllable_dir: Path, rng: np.random.Generator) -> np.ndarray:
    base, drift, length = MOODS[mood]
    parts = []
    for index, syllable in enumerate(text):
        t = index / max(len(text) - 1, 1)
        # 음높이 곡선 + 음절마다 살짝 흔들림 (같은 음이 반복되면 기계처럼 들린다)
        pitch = base * (1 + (drift - 1) * t) * (1 + rng.uniform(-0.04, 0.04))
        parts += [grain(syllable_dir / f"{syllable}.wav", pitch, length), np.zeros(int(OUT_RATE * GAP_MS / 1000))]
    y = np.concatenate(parts)
    y = sosfilt(butter(2, 180, "highpass", fs=OUT_RATE, output="sos"), y)
    y = sosfilt(butter(4, 9000, "lowpass", fs=OUT_RATE, output="sos"), y)
    return y / np.abs(y).max() * 0.85


def main(syllable_dir: str, out: str) -> None:
    syllables = Path(syllable_dir)
    needed = sorted({s for text, _ in LINES.values() for s in text if not (syllables / f"{s}.wav").exists()})
    if needed:
        script = Path(__file__).with_name("syllables.ps1")
        subprocess.run(["pwsh", "-NoProfile", "-File", str(script), "-Out", str(syllables), "-Syllables", ",".join(needed)], check=True)
    out_dir = Path(out)
    out_dir.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(7)
    for line, (text, mood) in LINES.items():
        y = babble(text, mood, syllables, rng)
        wavfile.write(out_dir / f"{line}.wav", OUT_RATE, (y * 32767).astype(np.int16))
        print(f"{line:8s} {text:5s} {mood:8s} {len(y) / OUT_RATE:.2f}s")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
