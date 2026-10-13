"""tts.ps1로 녹음한 사람 목소리를 카피바라 캐릭터 목소리로 가공해 public/sfx/voice/*.wav로 낸다.

사용: python scripts/audio/voices.py <원본 폴더> <출력 폴더>
처리: 앞뒤 무음 자르기 → 대사별 음높이 올림(재샘플) → 저역 컷·존재감(3kHz) 부스트 → 따뜻한 포화 →
      압축 → 살짝 어긋난 겹목소리(더블링) → 페이드 → -1dBFS 정규화 → 24kHz 16bit 모노
"""

import sys
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, resample_poly, sosfilt

OUT_RATE = 24000

# 대사별 음높이 배수: 성인 여자 목소리가 유지되게 살짝만 올린다 (1.0 = 원래 목소리, 1.15를 넘기면 아이 목소리가 된다)
PITCH = {
    "lose": 0.98, "yawn": 1.0, "ahh": 1.0, "careful": 1.02,
    "yay": 1.1, "wow": 1.08, "woah": 1.08, "win": 1.08, "record": 1.06, "levelup": 1.06,
    "hup": 1.1, "oops": 1.08, "ouch": 1.08, "yum": 1.1,
}
DEFAULT_PITCH = 1.04


def trim(x: np.ndarray, rate: int) -> np.ndarray:
    level = np.abs(x)
    window = int(rate * 0.01)
    env = np.convolve(level, np.ones(window) / window, mode="same")
    loud = np.where(env > env.max() * 0.03)[0]
    pad = int(rate * 0.015)
    return x[max(loud[0] - pad, 0): loud[-1] + pad * 3]


def shelf(x: np.ndarray, rate: int) -> np.ndarray:
    low_cut = butter(2, 140, "highpass", fs=rate, output="sos")
    presence = butter(2, [2200, 5200], "bandpass", fs=rate, output="sos")
    air_cut = butter(4, 10000, "lowpass", fs=rate, output="sos")
    y = sosfilt(low_cut, x)
    y = y + 0.55 * sosfilt(presence, y)
    return sosfilt(air_cut, y)


def compress(x: np.ndarray, rate: int, threshold=0.25, ratio=3.5) -> np.ndarray:
    attack, release = np.exp(-1 / (rate * 0.003)), np.exp(-1 / (rate * 0.08))
    env, gains = 0.0, np.empty_like(x)
    for i, sample in enumerate(np.abs(x)):
        coeff = attack if sample > env else release
        env = coeff * env + (1 - coeff) * sample
        gains[i] = 1.0 if env <= threshold else (threshold + (env - threshold) / ratio) / env
    return x * gains


def double(x: np.ndarray, rate: int) -> np.ndarray:
    # 같은 목소리를 아주 조금 높이고 12ms 늦게 겹쳐 얇은 TTS 느낌을 두툼한 캐릭터 목소리로 만든다
    shifted = resample_poly(x, 200, 203)
    delay = int(rate * 0.012)
    y = np.zeros(max(len(x), len(shifted) + delay))
    y[: len(x)] += x
    y[delay: delay + len(shifted)] += 0.3 * shifted
    return y


def process(path: Path) -> np.ndarray:
    rate, data = wavfile.read(path)
    # 사람 녹음은 스테레오·24/32bit·float일 수 있다
    x = data.astype(np.float64)
    if x.ndim > 1:
        x = x.mean(axis=1)
    x /= np.abs(x).max() or 1
    x = trim(x, rate)
    # 재샘플로 음높이를 올리면 길이도 함께 줄어 말이 더 경쾌해진다 (만화 캐릭터 목소리 방식)
    pitch = PITCH.get(path.stem, DEFAULT_PITCH)
    x = resample_poly(x, OUT_RATE * 100, int(rate * pitch * 100))
    x = shelf(x, OUT_RATE)
    x = np.tanh(x / np.abs(x).max() * 1.6) / np.tanh(1.6)
    x = compress(x, OUT_RATE)
    x = double(x, OUT_RATE)
    fade_in, fade_out = int(OUT_RATE * 0.004), int(OUT_RATE * 0.04)
    x[:fade_in] *= np.linspace(0, 1, fade_in)
    x[-fade_out:] *= np.linspace(1, 0, fade_out)
    return x / np.abs(x).max() * 0.89


def main(src: str, out: str) -> None:
    out_dir = Path(out)
    out_dir.mkdir(parents=True, exist_ok=True)
    for path in sorted(Path(src).glob("*.wav")):
        y = process(path)
        wavfile.write(out_dir / path.name, OUT_RATE, (y * 32767).astype(np.int16))
        print(f"{path.stem:10s} {len(y) / OUT_RATE:.2f}s")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
