"""옷장 옷의 방향별 그림(뒤·옆·앞대각선·뒤대각선)을 만들고 자른다. 정면 그림은 split_wardrobe.py가 만든 <id>.webp 그대로 쓴다.

python scripts/wardrobe_views.py gen [slot/id ...]   → 옷마다 가로 4칸 시트 생성 (이미 있으면 건너뜀, 2개씩 동시에 — 메모리 부족으로 죽지 않게)
python scripts/wardrobe_views.py split               → 시트를 잘라 public/.../wardrobe/<slot>/<id>-<view>.webp 로 저장

칸 순서는 lib/lobby/wardrobe.ts 의 VIEW_ART 순서(back, side, front3q, back3q)와 같아야 한다.
"""

import re
import shutil
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from make_image import ASSETS_DIR, make_image  # noqa: E402
from split_wardrobe import key_magenta  # noqa: E402  (import 시 시트가 없으면 건너뛰기만 한다)

SLOTS = ["hat", "glasses", "top", "bottom", "onepiece", "shoes", "gloves"]
VIEWS = ["back", "side", "front3q", "back3q"]
CAPY = ROOT / "assets-src/characters/capybara"
WARDROBE = ROOT / "public/assets/images/characters/capybara/wardrobe"
SRC_DIR = ROOT / "assets-src/characters/capybara/wardrobe/views"

HOW = {
    "hat": "머리에 쓴 모자만 (카피바라 귀가 들어갈 자리는 비워 둔 모양 그대로)",
    "glasses": "얼굴에 쓴 안경만 (옆에서는 앞 렌즈 하나와 귀로 가는 안경다리가 보이는 모양, 뒤에서는 안경다리 끝만)",
    "top": "몸통에 입은 상의만 (소매 포함)",
    "bottom": "허리~허벅지에 입은 하의만",
    "onepiece": "몸통~다리에 입은 한벌옷만 (후드·꼬리 같은 장식 포함)",
    "shoes": "신발 한 짝만 (한 칸에 딱 하나)",
    "gloves": "장갑 한 짝만 (한 칸에 딱 하나)",
}
PAIR_NOTE = (
    "신발·장갑은 칸마다 한 짝만 그린다. 뒤 칸은 뒤꿈치(장갑은 손등) 쪽, 옆 칸은 오른쪽을 향한 옆모습, "
    "앞대각선 칸은 오른쪽 아래를 향한 3/4, 뒤대각선 칸은 오른쪽 위를 향한 3/4."
)


def items() -> list[tuple[str, str, str]]:
    """wardrobe.ts 에서 (slot, id, label)을 읽는다"""
    text = (ROOT / "lib/lobby/wardrobe.ts").read_text(encoding="utf-8")
    found = []
    for slot in SLOTS:
        block = re.search(rf"\n  {slot}: \{{(.*?)\n  \}},", text, re.S).group(1)
        found += [(slot, i, label) for i, label in re.findall(r'id: "([^"]+)", label: "([^"]+)"', block)]
    return found


def sheet_name(slot: str, item_id: str) -> str:
    return f"wardrobe-views-{slot}-{item_id}"


def gen_one(slot: str, item_id: str, label: str) -> str:
    name = sheet_name(slot, item_id)
    if (ASSETS_DIR / f"{name}.png").exists() or (SRC_DIR / f"{slot}-{item_id}.png").exists():
        return f"{name}: 이미 있음"
    prompt = (
        f"첫 번째 참고 이미지는 카피바라 인형 옷 '{label}'의 정면 그림이다. 이 옷과 완전히 같은 디자인·색·무늬·털/펠트 질감으로, "
        f"{HOW[slot]}을 다른 각도에서 본 그림 4개를 가로 한 줄(가로 4칸, 칸 폭 같게, 칸 사이 넉넉히 띄움)로 그린다. "
        "나머지 참고 이미지 4장은 카피바라가 서 있는 각도다 (순서대로 뒷모습, 오른쪽 옆모습, 오른쪽 아래 대각선 3/4, 오른쪽 위 대각선 3/4). "
        "칸 순서도 똑같이: 1칸 뒷모습, 2칸 오른쪽 옆모습, 3칸 오른쪽 아래 대각선 3/4, 4칸 오른쪽 위 대각선 3/4. "
        "각 칸의 옷은 그 각도의 카피바라가 입었을 때 보이는 모양 그대로 (뒤에서는 앞 단추·앞 무늬가 안 보이고 등판이 보임, 옆에서는 몸 두께만큼 좁음). "
        "카피바라 몸은 그리지 말고 옷만, 속이 빈 옷처럼. 그림자·바닥·글자 없음. "
        f"{PAIR_NOTE if slot in ('shoes', 'gloves') else ''} "
        "배경은 순수 마젠타(#FF00FF) 단색, 체크무늬 금지. 가로로 긴 이미지."
    )
    refs = [WARDROBE / slot / f"{item_id}.webp"] + [CAPY / f"capybara-stand-{v}.png" for v in ("up", "right", "down-right", "up-right")]
    make_image(prompt, name, [str(r) for r in refs], transparent=False)
    return f"{name}: 생성"


def gen(selected: list[str]) -> None:
    todo = [t for t in items() if not selected or f"{t[0]}/{t[1]}" in selected]
    with ThreadPoolExecutor(2) as pool:
        for result in pool.map(lambda t: _safe(gen_one, *t), todo):
            print(result, flush=True)


def _safe(fn, *args) -> str:
    try:
        return fn(*args)
    except Exception as error:  # 한 벌 실패해도 나머지는 계속
        return f"{args[:2]}: 실패 {error}"


def split() -> None:
    SRC_DIR.mkdir(parents=True, exist_ok=True)
    for slot, item_id, _ in items():
        made = ASSETS_DIR / f"{sheet_name(slot, item_id)}.png"
        kept = SRC_DIR / f"{slot}-{item_id}.png"
        if made.exists():
            shutil.copy(made, kept)
        if not kept.exists():
            print(f"{slot}/{item_id}: 시트 없음, 건너뜀")
            continue
        sheet = key_magenta(Image.open(kept))
        # 칸 경계는 알파가 비어 있는 세로줄로 찾는다 (생성 이미지라 4등분이 딱 맞지 않을 수 있다)
        alpha = sheet.getchannel("A").point(lambda v: 255 if v > 16 else 0)
        cols = [alpha.crop((x, 0, x + 1, sheet.height)).getbbox() is not None for x in range(sheet.width)]
        runs, start = [], None
        for x, filled in enumerate(cols + [False]):
            if filled and start is None:
                start = x
            elif not filled and start is not None:
                runs.append((start, x))
                start = None
        runs = [r for r in runs if r[1] - r[0] > sheet.width * 0.02]  # 털 부스러기 제거
        if len(runs) != len(VIEWS):
            print(f"{slot}/{item_id}: 칸 {len(runs)}개 (4개여야 함), 건너뜀")
            continue
        for view, (x0, x1) in zip(VIEWS, runs):
            piece = sheet.crop((x0, 0, x1, sheet.height))
            piece = piece.crop(piece.getchannel("A").point(lambda v: 255 if v > 16 else 0).getbbox())
            piece.thumbnail((384, 384), Image.LANCZOS)
            piece.save(WARDROBE / slot / f"{item_id}-{view}.webp", "WEBP", quality=90, method=6)
        print(f"{slot}/{item_id}: {', '.join(VIEWS)}")


if __name__ == "__main__":
    if sys.argv[1:2] == ["gen"]:
        gen(sys.argv[2:])
    elif sys.argv[1:2] == ["split"]:
        split()
    else:
        print(__doc__)
