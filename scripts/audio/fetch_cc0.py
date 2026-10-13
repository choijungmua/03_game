"""CC0 효과음 원본을 받는다 (OpenGameArt: pop sounds 0 by EZduzziteh, 80 CC0 creature SFX by rubberduck).

사용: python scripts/audio/fetch_cc0.py <받을 폴더>
"""

import io
import sys
import urllib.request
import zipfile
from pathlib import Path

import soundfile as sf

BASE = "https://opengameart.org/sites/default/files/"
HEADERS = {"User-Agent": "Mozilla/5.0"}


def get(url: str) -> bytes:
    with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=120) as response:
        return response.read()


def main(out: str) -> None:
    root = Path(out)
    (root / "pop").mkdir(parents=True, exist_ok=True)
    for i in range(1, 10):
        (root / "pop" / f"pop{i}.wav").write_bytes(get(f"{BASE}pop{i}.wav"))
    zipfile.ZipFile(io.BytesIO(get(BASE + "80-CC0-creature-SFX_0.zip"))).extractall(root / "creature")
    for path in sorted(root.rglob("*")):
        if path.suffix.lower() in (".wav", ".ogg"):
            info = sf.info(path)
            print(f"{path.relative_to(root)}  {info.duration:.2f}s {info.samplerate}Hz ch{info.channels}")


if __name__ == "__main__":
    main(sys.argv[1])
