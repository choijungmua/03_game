"""카피바라 배구 에셋: Codex 시트(마젠타 배경)를 잘라 게임용 WebP로 만든다.
python scripts/slice_volleyball.py  (원본은 assets-src/games/capybara-volleyball/)"""
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets-src/games/capybara-volleyball"
OUT = ROOT / "public/assets/images/games/capybara-volleyball"


def key(path):
    """마젠타를 초록 대비 빨강·파랑 차이로 지워 알파를 만든다"""
    rgb = np.asarray(Image.open(path).convert("RGB")).astype(float)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    magenta = np.minimum(r, b) - g
    alpha = np.clip((140 - magenta) / 60, 0, 1)
    # 가장자리 분홍 번짐: 반투명 부분의 빨강·파랑을 초록 쪽으로 당긴다
    edge = (alpha < 1)[..., None]
    rgb = np.where(edge, np.dstack([np.minimum(r, g + 40), g, np.minimum(b, g + 40)]), rgb)
    out = np.dstack([rgb, alpha * 255]).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def parts(image, count):
    alpha = np.asarray(image)[..., 3] > 40
    labels, n = ndimage.label(ndimage.binary_closing(alpha, iterations=6))
    sizes = ndimage.sum(alpha, labels, range(1, n + 1))
    keep = sorted(np.argsort(sizes)[-count:] + 1, key=lambda l: ndimage.find_objects(labels == l)[0][1].start)
    boxes = []
    for label in keep:
        ys, xs = ndimage.find_objects((labels == label).astype(int))[0]
        boxes.append((xs.start, ys.start, xs.stop, ys.stop))
    return boxes


def save(image, name, size):
    image.thumbnail((size, size), Image.LANCZOS)
    OUT.mkdir(parents=True, exist_ok=True)
    image.save(OUT / f"{name}.webp", quality=90)


def players(sheet, color):
    image = key(SRC / sheet)
    boxes = parts(image, 4)
    # 네 자세 같은 배율, 정사각 칸 바닥 가운데 정렬
    side = max(max(x1 - x0, y1 - y0) for x0, y0, x1, y1 in boxes)
    for pose, (x0, y0, x1, y1) in zip(["ready", "jump", "spike", "dive"], boxes):
        canvas = Image.new("RGBA", (side, side))
        crop = image.crop((x0, y0, x1, y1))
        canvas.paste(crop, ((side - crop.width) // 2, side - crop.height), crop)
        save(canvas, f"{color}-{pose}", 256)


def props():
    image = key(SRC / "props-sheet.png")
    for name, box, size in zip(["ball", "net", "scoreboard"], parts(image, 3), [128, 384, 512]):
        save(image.crop(box), name, size)


def buttons():
    image = key(SRC / "buttons-sheet.png")
    for name, box in zip(["left", "right", "jump", "spike"], parts(image, 4)):
        save(image.crop(box), f"btn-{name}", 192)


if __name__ == "__main__":
    Image.open(SRC / "court-bg.png").convert("RGB").resize((864, 608), Image.LANCZOS).save(OUT / "court.webp", quality=85)
    players("brown-sheet.png", "brown")
    players("white-sheet.png", "white")
    props()
    if (SRC / "buttons-sheet.png").exists():
        buttons()
