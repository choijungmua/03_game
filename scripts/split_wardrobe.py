"""옷장 시트(가로 3칸, 마젠타 배경)를 옷 한 벌씩 잘라 WebP로 저장한다.

python scripts/split_wardrobe.py  → scripts/make_image/assets/wardrobe-<slot>.png 중 있는 것만 처리
id 순서는 lib/lobby/wardrobe.ts 의 items 순서와 같아야 한다.
"""

import shutil
from pathlib import Path

from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parent.parent
ITEMS = {
    "hat": ["straw", "leaf", "beanie"],
    "glasses": ["wood", "sunglasses", "heart"],
    "top": ["knit-vest", "aloha", "hoodie"],
    "bottom": ["denim", "check", "grass-skirt"],
    "onepiece": ["raincoat", "overalls", "yukata"],
    "shoes": ["rain-boots", "sneakers", "geta"],
    "gloves": ["mitten", "rubber", "boxing"],
}


def key_magenta(image: Image.Image) -> Image.Image:
    """마젠타(빨강·파랑 높고 초록 낮음)일수록 투명하게. 분홍 옷(차이 60 미만)은 남는다"""
    r, g, b, a = image.convert("RGBA").split()
    magenta = ImageChops.subtract(ImageChops.darker(r, b), g)  # 0(옷) ~ 255(순수 마젠타)
    alpha = ImageChops.subtract(a, magenta.point(lambda v: 0 if v < 60 else min(255, (v - 60) * 3)))
    return Image.merge("RGBA", (r, g, b, alpha))


for slot, ids in ITEMS.items():
    sheet_path = ROOT / f"scripts/make_image/assets/wardrobe-{slot}.png"
    if not sheet_path.exists():
        print(f"{slot}: 시트 없음, 건너뜀")
        continue
    sheet = key_magenta(Image.open(sheet_path))
    cell = sheet.width // len(ids)
    out_dir = ROOT / f"public/assets/images/characters/capybara/wardrobe/{slot}"
    out_dir.mkdir(parents=True, exist_ok=True)
    for index, item_id in enumerate(ids):
        piece = sheet.crop((index * cell, 0, (index + 1) * cell, sheet.height))
        box = piece.getchannel("A").point(lambda v: 255 if v > 16 else 0).getbbox()
        if box is None:
            raise SystemExit(f"{slot}/{item_id}: 빈 칸")
        piece = piece.crop(box)
        piece.thumbnail((384, 384), Image.LANCZOS)
        piece.save(out_dir / f"{item_id}.webp", "WEBP", quality=90, method=6)
    src_dir = ROOT / "assets-src/characters/capybara/wardrobe"
    src_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy(sheet_path, src_dir / f"{slot}.png")
    print(f"{slot}: {', '.join(ids)}")
