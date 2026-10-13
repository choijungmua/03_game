"""fetch_cc0.py로 받은 CC0 효과음 중 귀여운 것만 골라 public/sfx/fx/*.wav(24kHz 모노)로 낸다.

사용: python scripts/audio/fx.py <받은 폴더> <출력 폴더>
출처(모두 CC0): pop sounds 0 by EZduzziteh, 80 CC0 creature SFX by rubberduck (OpenGameArt)
"""

import sys
from fractions import Fraction
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.io import wavfile
from scipy.signal import resample_poly

OUT_RATE = 24000

# 게임에서 부를 이름 → 원본
PICKS = {
    "pop1": "pop/pop1.wav", "pop2": "pop/pop2.wav", "pop3": "pop/pop4.wav", "pop4": "pop/pop8.wav",
    **{f"cute{i}": f"creature/cute_{i:02d}.ogg" for i in range(1, 11)},
    "eat1": "creature/eat_01.ogg", "eat2": "creature/eat_02.ogg", "snore": "creature/snore.ogg",
}


def main(src: str, out: str) -> None:
    out_dir = Path(out)
    out_dir.mkdir(parents=True, exist_ok=True)
    for name, path in PICKS.items():
        x, rate = sf.read(Path(src) / path)
        if x.ndim > 1:
            x = x.mean(axis=1)
        ratio = Fraction(OUT_RATE, rate)
        x = resample_poly(x, ratio.numerator, ratio.denominator)
        x = x / (np.abs(x).max() or 1) * 0.89
        wavfile.write(out_dir / f"{name}.wav", OUT_RATE, (x * 32767).astype(np.int16))
        print(f"{name:6s} {len(x) / OUT_RATE:.2f}s")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
