"""Codex 시트(가로 4 × 세로 2, 마젠타 배경)를 칸마다 잘라 투명 WebP로 저장한다.
같은 시트 안의 상대 크기는 유지한다(가장 큰 칸의 긴 변 = MAX_PX). 크기 표는 sprites.ts에 쓴다.
실행: python assets-src/games/capybara-run/slice.py (저장소 루트에서)"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
SRC = Path(__file__).parent
OUT = ROOT / "public/assets/images/games/capybara-run"
SHEETS = {
    "capybara-sheet.png": ["run-1", "run-2", "run-3", "run-4", "jump", "tumble", "slide", "hang"],
    "props-sheet.png": ["coin", "thorn", "log", "branch", "step", "heart", "cliff", "crown"],
}
MAX_PX = 320


def key_out(image: Image.Image) -> Image.Image:
    """마젠타 배경을 지우고, 가장자리 섞인 색은 반투명으로 풀어 테두리가 분홍으로 남지 않게 한다"""
    image = image.convert("RGBA")
    pixels = image.load()
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, _ = pixels[x, y]
            k = min(r, b) - g
            if k > 90:
                pixels[x, y] = (0, 0, 0, 0)
            elif k > 30:
                t = (k - 30) / 60
                pixels[x, y] = (int(r - (r - g) * t), g, int(b - (b - g) * t), int(255 * (1 - t)))
    return image


sizes = {}
for sheet, names in SHEETS.items():
    image = key_out(Image.open(SRC / sheet))
    cell_w, cell_h = image.width / 4, image.height / 2
    crops = []
    for index, name in enumerate(names):
        col, row = index % 4, index // 4
        cell = image.crop((int(col * cell_w), int(row * cell_h), int((col + 1) * cell_w), int((row + 1) * cell_h)))
        crops.append((name, cell.crop(cell.getbbox())))
    scale = MAX_PX / max(max(crop.size) for _, crop in crops)
    for name, crop in crops:
        size = (max(1, round(crop.width * scale)), max(1, round(crop.height * scale)))
        crop.resize(size, Image.LANCZOS).save(OUT / f"{name}.webp", "WEBP", quality=90)
        sizes[name] = size

lines = ["// slice.py가 만든 파일. 고치지 말고 시트를 바꾼 뒤 다시 실행한다", "/** 그림 이름 → [가로, 세로](px). 같은 시트끼리 상대 크기가 맞는다 */", "export const SPRITE_SIZES = {"]
lines += [f'  "{name}": [{w}, {h}],' for name, (w, h) in sizes.items()]
lines += ["} as const;", "", "export type SpriteName = keyof typeof SPRITE_SIZES;", ""]
(ROOT / "app/games/_games/capybara-run/sprites.ts").write_text("\n".join(lines), encoding="utf-8")
print(sizes)
