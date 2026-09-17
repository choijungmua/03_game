"""카피바라 테마 에셋 시트(마젠타 또는 투명 배경)를 조각으로 잘라 원본 PNG + 게임용 WebP로 저장한다.

python scripts/cut_emoji_sheets.py [시트이름 …]   → scripts/make_image/assets/<시트>.png 중 있는 것만 처리

시트는 `python -m make_image ... --keep-background -m gpt-5.6-luna` 로 만든다 (프롬프트는 docs/EMOJI-ASSETS.md).
같은 세로줄에 평소 얼굴·우는 얼굴을 쌓은 시트는 두 프레임이 어긋나지 않게 **같은 잘라내기 상자**를 쓴다.
"""

import sys
from pathlib import Path

from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parent.parent
SHEETS = ROOT / "scripts/make_image/assets"

#: 과일·동물 그림을 정사각형에 담을 때 실루엣 둘레에 두는 여백 배율.
#: 게임 코드(FRUIT_IMAGE_SCALE)와 짝이라 한쪽만 바꾸면 크기가 어긋난다
PAD = 1.16
#: 캐릭터 시트: 1024 캔버스에서 가장 큰 프레임의 높이와 발바닥 y (다른 카피바라 스프라이트와 같은 규칙)
CHAR_CANVAS = 1024
CHAR_HEIGHT = 980
CHAR_FOOT = 1000  # capybara-stand-*.png 와 같은 발바닥 높이


def key_magenta(image: Image.Image) -> Image.Image:
    """마젠타(빨강·파랑 높고 초록 낮음) 배경을 투명하게. 이미 투명 배경이면 그대로 둔다"""
    image = image.convert("RGBA")
    if image.getpixel((0, 0))[3] == 0:
        return image
    r, g, b, a = image.split()
    magenta = ImageChops.subtract(ImageChops.darker(r, b), g)  # 0(그림) ~ 255(순수 마젠타)
    alpha = ImageChops.subtract(a, magenta.point(lambda v: 0 if v < 60 else min(255, (v - 60) * 3)))
    return Image.merge("RGBA", (r, g, b, alpha))


def cells(sheet: Image.Image, cols: int, rows: int) -> list[Image.Image]:
    """시트를 같은 크기 격자로 나눈다 (왼쪽 위부터 가로 순서)"""
    w, h = sheet.width // cols, sheet.height // rows
    return [sheet.crop((c * w, r * h, (c + 1) * w, (r + 1) * h)) for r in range(rows) for c in range(cols)]


def content_box(image: Image.Image) -> tuple[int, int, int, int]:
    """흐린 가장자리를 뺀 알맹이 상자. 빈 칸이면 이미지 전체"""
    return image.getchannel("A").point(lambda v: 255 if v > 24 else 0).getbbox() or (0, 0, image.width, image.height)


def squared(image: Image.Image, box: tuple[int, int, int, int], size: int) -> Image.Image:
    """box 를 감싸는 정사각형(둘레 PAD 여백)으로 잘라 size×size 로 줄인다"""
    left, top, right, bottom = box
    side = max(right - left, bottom - top) * PAD
    cx, cy = (left + right) / 2, (top + bottom) / 2
    canvas = Image.new("RGBA", (round(side), round(side)), (0, 0, 0, 0))
    canvas.alpha_composite(image, (round(side / 2 - cx), round(side / 2 - cy)))
    return canvas.resize((size, size), Image.LANCZOS)


def trimmed(image: Image.Image, long_side: int) -> Image.Image:
    """알맹이까지 잘라내고 긴 변을 long_side 로 맞춘다 (소품·아이콘용)"""
    image = image.crop(content_box(image))
    ratio = long_side / max(image.width, image.height)
    return image.resize((max(1, round(image.width * ratio)), max(1, round(image.height * ratio))), Image.LANCZOS)


#: 세로 울타리: 기둥 바닥에서 아래 칸 기둥까지 이어지는 판의 길이 (기둥 높이 대비). 로비 타일 한 칸과 같다
RAIL_RATIO = 233 / 245


def cut_rails(image: Image.Image) -> tuple[Image.Image, Image.Image]:
    """세로 울타리 그림을 (기둥 + 한 타일 길이 판, 기둥만) 둘로 자른다.

    그림 생성이 판 길이를 좀처럼 못 맞춰서, 기둥(가장 넓은 부분) 높이를 재 RAIL_RATIO 만큼만 남긴다.
    모서리 기둥도 같은 그림에서 떼어내야 이어 붙였을 때 기둥 두 개가 똑같이 보인다.
    """
    image = image.crop(content_box(image))
    # 줄마다 그림이 있는 픽셀 수 — 기둥 줄은 가득 차고, 판 두 줄만 있는 아래쪽은 훨씬 적다
    solid = image.getchannel("A").point(lambda v: 1 if v > 24 else 0)
    filled = [sum(solid.crop((0, y, image.width, y + 1)).getdata()) for y in range(image.height)]
    post_rows = [y for y, n in enumerate(filled) if n > max(filled) * 0.85]  # 판 두 줄만 있는 줄도 기둥 폭의 70%쯤 차서 넉넉히 잡는다
    post_top, post_bottom = post_rows[0], post_rows[-1]
    keep = round(post_bottom + (post_bottom - post_top) * RAIL_RATIO)
    return image.crop((0, 0, image.width, min(image.height, keep))), image.crop((0, 0, image.width, post_bottom + 1))


def save(image: Image.Image, png: Path, webp: Path) -> None:
    png.parent.mkdir(parents=True, exist_ok=True)
    webp.parent.mkdir(parents=True, exist_ok=True)
    image.save(png)
    image.save(webp, "WEBP", quality=90, method=6)
    print(f"  {webp.relative_to(ROOT)} ({image.width}×{image.height})")


def cut_pairs(sheet: Image.Image, slugs: list[str], png_dir: Path, webp_dir: Path, size: int) -> None:
    """윗줄 평소 얼굴 / 아랫줄 우는 얼굴 시트. 세로줄마다 같은 상자로 잘라 두 프레임을 겹치게 맞춘다"""
    grid = cells(sheet, len(slugs), 2)
    for index, slug in enumerate(slugs):
        calm, cry = grid[index], grid[index + len(slugs)]
        box = content_box(calm)  # 눈물이 튀어 넓어진 우는 얼굴이 아니라 평소 얼굴 기준으로 맞춘다
        save(squared(calm, box, size), png_dir / f"{slug}.png", webp_dir / f"{slug}.webp")
        save(squared(cry, box, size), png_dir / f"{slug}-cry.png", webp_dir / f"{slug}-cry.webp")


def cut_props(sheet: Image.Image, names: list[str], out: list[tuple[Path, Path]], long_side: int) -> None:
    """가로로 늘어놓은 소품 시트. 하나씩 알맹이까지 잘라 낸다"""
    for cell, name, (png, webp) in zip(cells(sheet, len(names), 1), names, out, strict=True):
        print(f"  [{name}]")
        save(trimmed(cell, long_side), png, webp)


def cut_character(sheet: Image.Image, rows: list[str], frames: int, out_png: Path, out_webp: Path, size: int) -> None:
    """캐릭터 동작 시트. 모든 프레임을 한 배율로 줄이고 발바닥 높이를 맞춰 1024 캔버스에 올린다"""
    grid = cells(sheet, frames, len(rows))
    boxes = [content_box(cell) for cell in grid]
    ratio = CHAR_HEIGHT / max(bottom - top for _, top, _, bottom in boxes)
    out_png.mkdir(parents=True, exist_ok=True)
    out_webp.mkdir(parents=True, exist_ok=True)
    for index, cell in enumerate(grid):
        piece = cell.crop(boxes[index])
        piece = piece.resize((max(1, round(piece.width * ratio)), max(1, round(piece.height * ratio))), Image.LANCZOS)
        canvas = Image.new("RGBA", (CHAR_CANVAS, CHAR_CANVAS), (0, 0, 0, 0))
        canvas.alpha_composite(piece, ((CHAR_CANVAS - piece.width) // 2, CHAR_FOOT - piece.height))
        name = f"capybara-pick-{index % frames + 1}-{rows[index // frames]}"
        canvas.save(out_png / f"{name}.png")  # 원본은 다른 캐릭터 그림과 같은 1024 캔버스
        canvas.resize((size, size), Image.LANCZOS).save(out_webp / f"{name}.webp", "WEBP", quality=90, method=6)
        print(f"  {(out_webp / f'{name}.webp').relative_to(ROOT)} ({size}×{size})")


FISH_CATCHES = (ROOT / "assets-src/ui/lobby/fish-catches", ROOT / "public/assets/images/ui/lobby/fish-catches")
WATERMELON = (ROOT / "assets-src/games/watermelon-game/fruits", ROOT / "public/assets/images/games/watermelon-game/fruits")
PANG = (ROOT / "assets-src/games/capybara-pang/animals", ROOT / "public/assets/images/games/capybara-pang/animals")


def lobby_prop(asset_id: str) -> tuple[Path, Path]:
    return (
        ROOT / f"assets-src/lobby/props/{asset_id}/source.png",
        ROOT / f"public/assets/images/lobby/props/{asset_id}/image.webp",
    )


def game_icon(slug: str) -> tuple[Path, Path]:
    return ROOT / f"assets-src/games/{slug}/icon.png", ROOT / f"public/assets/images/games/{slug}/icon.webp"


def run(name: str, sheet: Image.Image) -> None:
    if name == "emoji-apples":
        cut_props(
            sheet,
            ["사과", "초록 사과", "썩은 사과"],
            [(FISH_CATCHES[0] / f"{s}.png", FISH_CATCHES[1] / f"{s}.webp") for s in ("apple", "green-apple", "rotten-apple")],
            512,
        )
    elif name == "emoji-fence-vertical":
        rails, post = cut_rails(sheet)
        print("  [세로 울타리]")
        save(trimmed(rails, 384), *lobby_prop("fence-vertical"))
        print("  [모서리 기둥]")
        save(trimmed(post, 384), *lobby_prop("fence-post"))
    elif name == "emoji-game-icons":
        cut_props(sheet, ["수박 게임", "카피바라 팡"], [game_icon("watermelon-game"), game_icon("capybara-pang")], 384)
    elif name == "emoji-fruit-1":
        cut_pairs(sheet, ["cherry", "strawberry", "grape", "hallabong"], *WATERMELON, 256)
    elif name == "emoji-fruit-2":
        cut_pairs(sheet, ["persimmon", "apple", "pear", "peach"], *WATERMELON, 256)
    elif name == "emoji-fruit-3":
        cut_pairs(sheet, ["pineapple", "melon", "watermelon"], *WATERMELON, 256)
    elif name == "emoji-pang-1":
        cut_pairs(sheet, ["capybara", "rabbit", "cat", "dog"], *PANG, 192)
    elif name == "emoji-pang-2":
        cut_pairs(sheet, ["chick", "pig", "monkey"], *PANG, 192)
    elif name == "emoji-pick":
        cut_character(
            sheet,
            ["up", "down"],
            3,
            ROOT / "assets-src/characters/capybara",
            ROOT / "public/assets/images/characters/capybara",
            384,
        )
    else:
        raise SystemExit(f"모르는 시트: {name}")


SHEET_NAMES = [
    "emoji-apples",
    "emoji-fence-vertical",
    "emoji-game-icons",
    "emoji-fruit-1",
    "emoji-fruit-2",
    "emoji-fruit-3",
    "emoji-pang-1",
    "emoji-pang-2",
    "emoji-pick",
]

if __name__ == "__main__":
    for name in sys.argv[1:] or SHEET_NAMES:
        path = SHEETS / f"{name}.png"
        if not path.exists():
            print(f"{name}: 시트 없음, 건너뜀")
            continue
        print(f"{name}:")
        run(name, key_magenta(Image.open(path)))
