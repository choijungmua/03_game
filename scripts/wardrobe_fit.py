"""옷이 스프라이트마다 몸에 딱 맞게 자리를 계산해 lib/lobby/wardrobe-fit.ts 를 만든다.

python scripts/wardrobe_fit.py                 → 스프라이트 기준점(머리·몸통·발·앞발·눈)을 재고, 옷마다 몸에 맞는 상자를 찾아 wardrobe-fit.ts 생성
python scripts/wardrobe_fit.py sheet [slot/id] → 확인용 합성 시트 scripts/make_image/assets/wardrobe-fit-sheet.png (스프라이트 × 옷 조합)

1. 기준점: 스프라이트 알파·어두운 갈색(발·앞발·주둥이)·검정(눈) 덩어리에서 잰다. 틀린 스프라이트는 OVERRIDES 로 고친다
2. 맞추기: 방향 묶음(서기 앞·뒤·옆·앞대각선·뒤대각선, 앉기 앞·옆·뒤)마다 대표 스프라이트 한 장에서
   옷이 덮어야 할 곳(몸통 띠·발·앞발·머리 윗부분·눈)을 덮고 몸 밖으로 덜 삐져나오는 상자를 찾는다
3. 저장: 상자를 기준점 폭에 대한 상대값으로 저장해서, 같은 묶음의 다른 동작(걷기·때리기·하품·졸기…)에서는 그 스프라이트 기준점을 따라간다
"""

import json
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw
from scipy import ndimage as nd

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from wardrobe_views import items  # noqa: E402

CAPY = ROOT / "public/assets/images/characters/capybara"
WARDROBE = CAPY / "wardrobe"
OUT = ROOT / "lib/lobby/wardrobe-fit.ts"
S = 384  # 기준점을 재는 해상도 (서기 스프라이트 원본 크기)
G = 128  # 맞추기 점수를 매기는 격자

BODY_SLOTS = ["onepiece"]
VIEW_ART = ["back", "side", "front3q", "back3q"]
DIRECTION_VIEW = {
    "down": "front", "up": "back", "left": "side", "right": "side",
    "down-left": "front3q", "down-right": "front3q", "up-left": "back3q", "up-right": "back3q",
}
REFERENCE = {
    "front": "stand-down", "back": "stand-up", "side": "stand-right", "front3q": "stand-down-right", "back3q": "stand-up-right",
    "sit-front": "idle-down", "sit-side": "idle-right", "sit-back": "idle-up",
}
# 자동으로 잘못 잰 기준점 손보기: {스프라이트: {키: 값}}
OVERRIDES: dict[str, dict] = {}


def sprite_names() -> list[str]:
    names = [p.stem.removeprefix("capybara-") for p in CAPY.glob("capybara-*.webp")]
    return sorted(n for n in names if not n.startswith("reading"))


def sprite_group(name: str) -> tuple[str, str, bool]:
    """(옷 그림 방향, 맞추기 묶음, 좌우 반전)"""
    sit = name.startswith(("idle-", "sleep-"))
    if name.startswith(("sleep", "stun", "eating")):
        direction = "down"
    elif name.startswith("scratch"):
        direction = "up"
    else:
        direction = re.sub(r"^(stand|walk1|walk2|punch|yawn-\d|doze-\d|idle)-", "", name)
    view = DIRECTION_VIEW[direction]
    if sit:
        return view, "sit-" + {"front": "front", "side": "side", "back": "back"}[view], direction.endswith("left")
    return view, view, direction.endswith("left")


def load_sprite(name: str) -> np.ndarray:
    return np.array(Image.open(CAPY / f"capybara-{name}.webp").convert("RGBA").resize((S, S), Image.LANCZOS)).astype(int)


def blob(mask: np.ndarray, lum: np.ndarray) -> dict:
    ys, xs = np.nonzero(mask)
    return dict(area=len(ys), x0=int(xs.min()), y0=int(ys.min()), x1=int(xs.max()) + 1, y1=int(ys.max()) + 1,
                cx=float(xs.mean()), cy=float(ys.mean()), lum=float(lum[ys, xs].mean()), mask=mask)


def components(mask: np.ndarray, lum: np.ndarray, min_area: int) -> list[dict]:
    lab, n = nd.label(mask)
    return [blob(lab == i, lum) for i in range(1, n + 1) if (lab == i).sum() >= min_area]


def split_blob(c: dict, lum: np.ndarray) -> list[dict]:
    """맞붙은 덩어리(두 발바닥, 주둥이+앞발)를 조금씩 깎아 둘 이상으로 떨어지면 그 씨앗에 가까운 픽셀끼리 나눈다"""
    mask = c["mask"]
    for iterations in range(2, 30, 2):
        lab, n = nd.label(nd.binary_erosion(mask, iterations=iterations))
        if n == 0:
            break
        sizes = nd.sum(lab > 0, lab, range(1, n + 1))
        seeds = [i + 1 for i, s in enumerate(sizes) if s >= sizes.max() * 0.2]
        if len(seeds) >= 2:
            _, (iy, ix) = nd.distance_transform_edt(~np.isin(lab, seeds), return_indices=True)
            owner = lab[iy, ix]
            return [blob(mask & (owner == i), lum) for i in seeds]
    return [c]


def central_run(row: np.ndarray, cx: float) -> tuple[int, int] | None:
    """행에서 cx에 가장 가까운 알파 구간 (팔·귀처럼 떨어진 조각 빼고 몸통 폭만 재려고)"""
    xs = np.flatnonzero(row)
    if len(xs) == 0:
        return None
    breaks = np.flatnonzero(np.diff(xs) > 1)
    starts = np.r_[xs[0], xs[breaks + 1]]
    ends = np.r_[xs[breaks], xs[-1]] + 1
    k = int(np.argmin([0 if s <= cx < e else min(abs(s - cx), abs(e - cx)) for s, e in zip(starts, ends)]))
    return int(starts[k]), int(ends[k])


def run_stats(body: np.ndarray, y0: float, y1: float, cx: float) -> tuple[float, float]:
    centers, widths = [], []
    for y in range(int(y0), int(y1)):
        run = central_run(body[y], cx)
        if run:
            centers.append((run[0] + run[1]) / 2)
            widths.append(run[1] - run[0])
    return float(np.median(centers)), float(np.median(widths))


def landmarks(name: str) -> dict:
    a = load_sprite(name)
    view, group, flip = sprite_group(name)
    sit = group.startswith("sit")
    lum = (a[..., 0] * 299 + a[..., 1] * 587 + a[..., 2] * 114) // 1000
    body = a[..., 3] > 128
    ys, xs = np.nonzero(body)
    top, bot = int(ys.min()), int(ys.max()) + 1
    h = bot - top
    cx0 = float(xs.mean())

    # 어두운 갈색: 가는 그림자 선이 끊기게 깎았다가 되살린다
    dark = nd.binary_erosion(body & (lum < 105), iterations=3)
    dark = nd.binary_dilation(dark, iterations=3) & body & (lum < 115)
    blobs = components(dark, lum, 120)
    ears = [c for c in blobs if c["cy"] < top + h * 0.14]
    face = [c for c in blobs if c not in ears and c["cy"] < top + h * 0.42 and c["area"] > 600 and view != "back" and view != "back3q"]
    muzzle = max(face, key=lambda c: c["area"]) if face else None

    # 머리: 턱 = 주둥이 아래, 뒷모습은 몸 높이 비율
    chin = (muzzle["y1"] + h * 0.02) if muzzle else top + h * (0.52 if sit else 0.49)
    head_cx, head_w = run_stats(body, top + (chin - top) * 0.35, chin - (chin - top) * 0.1, cx0)
    head = dict(cx=head_cx, cy=(top + chin) / 2, rx=head_w * 0.52, ry=(chin - top) / 2)

    # 발: 몸 맨 아래 띠의 어두운 덩어리 (띠를 좁혀 뒷모습 엉덩이 그림자와 떨어뜨린다)
    band = np.zeros_like(body)
    band[int(bot - h * (0.16 if sit else 0.075)):] = True
    # 앉으면 두 발바닥 사이 그림자가 이어져서, 깎아낸 덩어리로 나눈다
    if sit and view == "back":
        feet = []  # 앉은 뒷모습은 발이 엉덩이에 가려 안 보인다 (아래 어두운 곳은 그림자)
    elif sit:
        feet = [piece for c in blobs if c["y1"] > bot - h * 0.2 for piece in (split_blob(c, lum) if c["x1"] - c["x0"] > (xs.max() - xs.min()) * 0.35 else [c])]
    else:
        feet = components(body & (lum < 115) & band, lum, 60)
    feet = sorted(feet, key=lambda c: -c["area"])[:2]
    feet = [f for f in feet if f["area"] > feet[0]["area"] * 0.25]
    if not sit:
        # 띠로 자른 발은 납작하니, 발 폭의 0.4배 높이까지 몸 알파로 넓힌다 (한벌옷 위에 다시 그리는 발. 더 높이면 발목 위 털까지 보인다)
        for f in feet:
            region = np.zeros_like(body)
            region[int(f["y1"] - (f["x1"] - f["x0"]) * 0.4):f["y1"], f["x0"]:f["x1"]] = True
            f["mask"] = region & body
    foot_top = min((f["y0"] for f in feet), default=bot) if not sit else bot - h * 0.18

    # 앞발: 발·귀·주둥이가 아닌 갈색 덩어리. 눈(검정)은 뺀다
    # 앞발 후보가 주둥이와 붙어 크면 나누고, 머리 타원 안 조각(주둥이·귀 그림자)은 뺀다. 하품하며 든 앞발은 머리 옆이라 남는다
    candidates = [c for c in blobs if c not in ears and c is not muzzle and c not in feet]
    for _ in range(3):  # 나눈 조각이 아직 앞발보다 넓으면(주둥이+앞발) 한 번 더 나눈다
        candidates = [piece for c in candidates for piece in (split_blob(c, lum) if c["area"] > 5000 or c["x1"] - c["x0"] > 90 else [c])]
    in_head = lambda c: ((c["cx"] - head["cx"]) / head["rx"]) ** 2 + ((c["cy"] - head["cy"]) / head["ry"]) ** 2 < 0.8  # noqa: E731
    paws = [c for c in candidates if not in_head(c) and c["area"] > 250 and c["lum"] > 60
            and c["y1"] < bot - h * (0.2 if sit else 0.1) and c["cy"] > top + h * 0.12]
    paws = sorted(paws, key=lambda c: -c["area"])[:2]

    # 눈: 머리 안의 검정 덩어리
    eyes = []
    if view not in ("back", "back3q"):
        black = body & (lum < 60)
        # 눈은 머리 윗부분에만 있다 (아래쪽 검정은 입 선). 정면에서 두 개가 안 잡히면 버리고 대표 스프라이트 눈 자리를 쓴다
        # 납작한 검정(눈썹·감은 눈 선)은 눈이 아니다
        eyes = [c for c in components(black, lum, 25) if top + h * 0.15 < c["cy"] < min(chin, top + h * 0.28) and c["area"] < 900
                and c["x1"] - c["x0"] <= (c["y1"] - c["y0"]) * 2
                and (muzzle is None or not (muzzle["x0"] <= c["cx"] <= muzzle["x1"] and muzzle["y0"] <= c["cy"] <= muzzle["y1"]))]
        eyes = sorted(eyes, key=lambda c: -c["area"])[: 1 if view == "side" else 2]
        if view == "front" and len(eyes) < 2:
            eyes = []

    torso_cx, torso_w = run_stats(body, chin + (foot_top - chin) * 0.15, foot_top - (foot_top - chin) * 0.1, head_cx)
    order = (lambda c: -c["cx"]) if flip else (lambda c: c["cx"])
    lm = dict(
        view=view, group=group, flip=flip, top=top, bot=bot, chin=chin, foot_top=foot_top,
        head=head, torso=dict(cx=torso_cx, y=bot, w=torso_w),
        feet=[dict(cx=(f["x0"] + f["x1"]) / 2, y=f["y1"], w=f["x1"] - f["x0"], mask=f["mask"]) for f in sorted(feet, key=order)],
        paws=[dict(cx=(p["x0"] + p["x1"]) / 2, y=p["y1"], w=p["x1"] - p["x0"], mask=p["mask"]) for p in sorted(paws, key=order)],
        eyes=[dict(cx=e["cx"], cy=e["cy"], w=e["x1"] - e["x0"], box=(e["x0"], e["y0"], e["x1"], e["y1"])) for e in sorted(eyes, key=order)],
        body=body,
    )
    lm.update(OVERRIDES.get(name, {}))
    return lm


def anchor_of(lm: dict, slot: str) -> list[dict]:
    """칸마다 옷을 붙일 기준점 (cx, y, w) — 픽셀. 모자는 머리 꼭대기, 안경은 두 눈 가운데이고 둘 다 폭 대신 머리 높이로 크기를 잰다"""
    head = lm["head"]
    head_h = lm.get("head_scale", head["ry"] * 2)
    eyes = lm["eyes"]
    return {
        "hat": [dict(cx=head["cx"], y=lm["top"], w=head_h)],
        "glasses": [dict(cx=float(np.mean([e["cx"] for e in eyes])), y=float(np.mean([e["cy"] for e in eyes])), w=head_h)] if eyes else [],
        "top": [lm["torso"]], "bottom": [lm["torso"]], "onepiece": [lm["torso"]],
        "shoes": lm["feet"], "gloves": lm["paws"],
    }[slot]


# ---------- 옷 그림 ----------

def art_path(slot: str, item_id: str, view: str) -> Path:
    path = WARDROBE / slot / f"{item_id}-{view}.webp"
    return path if view != "front" and path.exists() else WARDROBE / slot / f"{item_id}.webp"


_alpha_cache: dict[Path, np.ndarray] = {}


def art_alpha(path: Path) -> np.ndarray:
    if path not in _alpha_cache:
        _alpha_cache[path] = np.array(Image.open(path).convert("RGBA"))[..., 3]
    return _alpha_cache[path]


GY, GX = np.mgrid[0:G, 0:G] + 0.5


def place(alpha: np.ndarray, x: float, bottom: float, w: float, h: float, mirror: bool) -> np.ndarray:
    """격자(G) 좌표 상자에 옷 알파를 놓은 마스크"""
    ih, iw = alpha.shape
    u = (GX - (x - w / 2)) / w
    v = (GY - (bottom - h)) / h
    inside = (u >= 0) & (u < 1) & (v >= 0) & (v < 1)
    if mirror:
        u = 1 - u
    iu = np.clip((u * iw).astype(int), 0, iw - 1)
    iv = np.clip((v * ih).astype(int), 0, ih - 1)
    return inside & (alpha[iv, iu] > 128)


def shrink(mask: np.ndarray) -> np.ndarray:
    return np.array(Image.fromarray(mask.astype(np.uint8) * 255).resize((G, G), Image.BOX)) > 127


def ellipse_mask(e: dict, k: float) -> np.ndarray:
    return ((GX - e["cx"] / k) / (e["rx"] / k)) ** 2 + ((GY - e["cy"] / k) / (e["ry"] / k)) ** 2 <= 1


def fit_box(alpha: np.ndarray, mirror: bool, score_fn, start: tuple[float, float, float]) -> tuple[float, float, float, float]:
    """(x, bottom, w, 가로세로 보정) 를 좌표 하강으로 찾는다. 가로세로 비율은 원래의 ±20% 안에서만 늘린다"""
    ratio = alpha.shape[0] / alpha.shape[1]

    def score(p):
        x, b, w, ar = p
        return score_fn(place(alpha, x, b, w, w * ratio * ar, mirror))

    best, best_s = None, -1e18
    for scale in (0.8, 1.0, 1.25):
        p = [start[0], start[1], start[2] * scale, 1.0]
        s = score(p)
        for step in (6, 3, 1.5, 0.75, 0.375):
            improved = True
            while improved:
                improved = False
                for i, d in ((0, step), (1, step), (2, step), (3, step / 30)):
                    for sign in (1, -1):
                        q = list(p)
                        q[i] += sign * d
                        if not 0.8 <= q[3] <= 1.2 or q[2] < 2:
                            continue
                        qs = score(q)
                        if qs > s:
                            p, s, improved = q, qs, True
        if s > best_s:
            best, best_s = p, s
    x, b, w, ar = best
    return x, b, w, w * ratio * ar


# 모자·안경 크기는 예전 정면 서기 자리(손으로 맞춘 값, 384px 기준 폭·아래 끝)를 머리 높이 비율로 옮겨 모든 방향·동작에 쓴다
HAT_FRONT = dict(width=138, bottom=88)
GLASSES_FRONT = dict(width=180, bottom=161)
# 옆모습 머리 가운데는 주둥이까지 쳐서 앞으로 쏠려 있어 모자를 뒤로 조금 민다 (머리 높이 단위, 오른쪽 보기 기준)
HAT_DX = {"side": -0.11}


def fill_path(item_id: str, view: str) -> Path:
    return WARDROBE / "onepiece" / f"{item_id}-{view}-fill.webp"


def make_fill(item_id: str) -> None:
    """한벌옷 그림의 빈틈(소매 사이·가랑이·반투명 가장자리)을 가장 가까운 옷 색으로 채운 그림. 몸 윤곽으로 잘라 그리면 윤곽 안이 빈틈 없이 덮인다"""
    for view in ("front", *VIEW_ART):
        pixels = np.array(Image.open(art_path("onepiece", item_id, view)).convert("RGBA"))
        # 가장자리는 지운 마젠타 배경이 섞인 색이라, 3px 안쪽 옷 색으로만 채운다 (안 그러면 보라·분홍이 번진다)
        inner = nd.binary_erosion(pixels[..., 3] > 128, iterations=3)
        _, (iy, ix) = nd.distance_transform_edt(~inner, return_indices=True)
        filled = pixels[iy, ix]
        filled[..., 3] = 255
        Image.fromarray(filled.astype(np.uint8)).save(fill_path(item_id, view), "WEBP", quality=88, method=6)


def onepiece_fit(lm: dict, anchor: dict) -> list[float]:
    """한벌옷: 채운 그림(-fill)을 머리 가운데~몸 맨 아래 윤곽 상자에 딱 맞게(조금 넉넉히) 늘린다.
    그릴 때 스프라이트 윤곽으로 잘라서 옷이 몸보다 뚱뚱하게 튀어나오지 않고, 윤곽 안 몸은 보이지 않는다.
    머리와 발은 옷 위에 타원으로 다시 그린다 (발 윗선에서 옷을 끊으면 앉았을 때 허벅지·배가 드러난다)"""
    top, bottom = lm["head"]["cy"], lm["bot"]
    xs = np.flatnonzero(lm["body"][int(top):int(bottom)].any(0))
    pad = (xs.max() + 1 - xs.min()) * 0.04
    x0, x1 = xs.min() - pad, xs.max() + 1 + pad
    aw = anchor["w"]
    sign = -1 if lm["flip"] else 1
    return [round(sign * ((x0 + x1) / 2 - anchor["cx"]) / aw, 3), round((bottom - anchor["y"]) / aw, 3),
            round((x1 - x0) / aw, 3), round((bottom - top) * 1.03 / aw, 3)]


def column_top(body: np.ndarray, x: float) -> float:
    """x 둘레 세로줄들에서 몸 알파가 시작되는 높이 (중앙값)"""
    tops = [int(np.argmax(body[:, c])) for c in range(int(x) - 3, int(x) + 4) if body[:, c].any()]
    return float(np.median(tops))


def head_item_fit(slot: str, item_id: str, lm: dict, front: dict) -> list[float]:
    """모자·안경: 정면 그림 높이를 머리 높이에 비례시켜 그 방향 그림을 같은 높이로 그린다 (옆·대각선 그림은 폭만 다르다)"""
    front_art = art_alpha(art_path(slot, item_id, "front"))
    art = art_alpha(art_path(slot, item_id, lm["view"]))
    front_head_h = front["head"]["ry"] * 2
    spec = HAT_FRONT if slot == "hat" else GLASSES_FRONT
    h = spec["width"] * front_art.shape[0] / front_art.shape[1] / front_head_h
    w = h * art.shape[1] / art.shape[0]
    view = lm["view"]
    if slot == "hat":
        # 모자 아래 끝은 모자 가운데 열의 머리 윤곽 꼭대기에서 정면과 같은 비율(모자 높이 단위)만큼 파묻는다.
        # 귀 끝 기준으로 두면 옆모습처럼 좁은 모자가 귀 사이 머리 위에 떠 보인다
        dx = HAT_DX.get(view, 0)
        sink = (spec["bottom"] - column_top(front["body"], front["head"]["cx"])) / (h * front_head_h)
        scale = lm["head_scale"]
        center = lm["head"]["cx"] + (-dx if lm["flip"] else dx) * scale
        bottom = column_top(lm["body"], center) + sink * h * scale
        return [round(dx, 3), round((bottom - lm["top"]) / scale, 3), round(w, 3), round(h, 3)]
    front_eye = anchor_of(front, "glasses")[0]
    center = (spec["bottom"] - h * front_head_h / 2 - front_eye["y"]) / front_head_h
    # 옆모습 안경 그림은 오른쪽 끝이 렌즈라서, 렌즈가 눈 위에 오게 그림 오른쪽 끝을 눈에서 조금만 앞에 둔다
    dx = (192 - front_eye["cx"]) / front_head_h if view == "front" else (h * 0.25 - w / 2 if view == "side" else 0)
    return [round(dx, 3), round(center + h / 2, 3), round(w, 3), round(h, 3)]


def fit_item(slot: str, item_id: str, lm: dict, front: dict) -> list[list[float]]:
    """대표 스프라이트에서 옷 상자를 찾아 기준점 상대값 [dx, dy, w, h] (기준점 폭 단위) 목록으로"""
    k = S / G
    body = shrink(lm["body"])
    alpha = art_alpha(art_path(slot, item_id, lm["view"]))
    anchors = anchor_of(lm, slot)
    head = ellipse_mask(lm["head"], k) & body
    rows = GY[:, 0]
    chin, foot_top, top, bot = lm["chin"] / k, lm["foot_top"] / k, lm["top"] / k, lm["bot"] / k
    fits = []
    # 앉은 발바닥은 정면을 향해 커서, 다 덮으려 하면 신발이 거인 신발이 된다. 서 있을 때 신발 크기를 넘지 않게 줄이려고 먼저 잰다
    stand_shoes = fit_item(slot, item_id, front, front) if slot == "shoes" and lm["group"].startswith("sit") and front["feet"] else None
    for index, anchor in enumerate(anchors):
        if slot == "onepiece":
            fits.append(onepiece_fit(lm, anchor))
            continue
        mirror = index == 1 and lm["view"] in ("front", "back")
        if slot in ("top", "bottom", "onepiece"):
            y0, y1 = {"top": (chin, chin + (foot_top - chin) * 0.62), "bottom": (chin + (foot_top - chin) * 0.5, foot_top),
                      "onepiece": (chin, foot_top)}[slot]
            band = ((rows >= y0) & (rows < y1))[:, None]
            target = body & band & ~head
            weights = (1.0, 0.25 if slot == "bottom" else 0.4, 0.7)
            # 턱보다 위인데 머리 타원 밖(목 뒤·머리 옆)은 머리를 다시 그려도 가려지지 않아 옷이 목까지 올라와 보인다
            above_chin = (rows < chin)[:, None] & ~head
            # 신발은 몸 옷 아래 층이라, 밑단이 발을 덮으면 신발이 가려진다 (앉으면 발바닥이 몸 앞으로 나와 특히 잘 덮인다)
            feet = np.zeros((G, G), bool)
            for foot in lm["feet"]:
                feet |= shrink(nd.binary_fill_holes(foot["mask"]))

            def score(m, target=target, above_chin=above_chin, feet=feet):
                v = m & ~head
                return ((v & target).sum() - weights[0] * (target & ~v).sum() - weights[1] * (v & body & ~target).sum()
                        - weights[2] * (v & ~body).sum() - 1.5 * (v & above_chin).sum() - 1.5 * (v & feet).sum())

            ys, xs = np.nonzero(target)
            start = (xs.mean(), y1 + (2 if slot != "top" else 4), float(np.median(target.sum(1)[target.sum(1) > 0])))
        elif slot in ("shoes", "gloves"):
            target = shrink(nd.binary_fill_holes(anchor["mask"]))

            def score(m, target=target):
                return (m & target).sum() - 2.5 * (target & ~m).sum() - 0.35 * (m & ~target).sum()

            ys, xs = np.nonzero(target)
            start = (xs.mean(), ys.max() + 1, (xs.max() - xs.min() + 1) * 1.2)
        else:
            fits.append(head_item_fit(slot, item_id, lm, front))
            continue
        x, b, w, h = fit_box(alpha, mirror, score, start)
        if stand_shoes:
            i = min(index, len(stand_shoes) - 1)
            cap = stand_shoes[i][2] * front["feet"][min(index, len(front["feet"]) - 1)]["w"] / k * lm["head_scale"] / front["head_scale"] * 1.15
            if w > cap:  # 줄인 신발은 발 가운데·발바닥에 붙인다 (크게 맞춘 아래 끝을 그대로 두면 발 아래로 처진다)
                w, h = cap, h * cap / w
                x, b = anchor["cx"] / k, anchor["y"] / k + 1
                if lm["view"] in ("side", "front3q"):
                    # 옆·대각선 신발 그림은 앞코가 오른쪽으로 뻗어 있어, 가운데에 두면 앞코가 발 밖으로 떠 보인다. 앞코를 발 끝에 맞춘다
                    x = (anchor["cx"] + anchor["w"] / 2) / k - w / 2
        sign = -1 if lm["flip"] else 1
        aw = anchor["w"] / k
        fits.append([round(sign * (x - anchor["cx"] / k) / aw, 3), round((b - anchor["y"] / k) / aw, 3), round(w / aw, 3), round(h / aw, 3)])
    return fits


# ---------- 생성 ----------

def pct(v: float) -> float:
    return round(v / S * 100, 2)


def sprite_record(lm: dict) -> dict:
    point = lambda a: [pct(a["cx"]), pct(a["y"]), pct(a["w"])]  # noqa: E731
    head = lm["head"]

    def foot_ellipse(mask: np.ndarray) -> list[float]:
        # 발 둘레 털까지 들어가게 조금 넉넉한 타원
        ys, xs = np.nonzero(mask)
        return [pct((xs.min() + xs.max() + 1) / 2), pct((ys.min() + ys.max() + 1) / 2), pct((xs.max() + 1 - xs.min()) * 0.58), pct((ys.max() + 1 - ys.min()) * 0.62)]

    return dict(
        view=lm["view"], group=lm["group"], flip=lm["flip"],
        head=[pct(head["cx"]), pct(head["cy"]), pct(head["rx"]), pct(head["ry"])],
        feet=[foot_ellipse(f["mask"]) for f in lm["feet"]],
        **{slot: [point(a) for a in anchor_of(lm, slot)] for slot in ("hat", "glasses", "top")},
    )


def build() -> None:
    names = sprite_names()
    lms = {n: landmarks(n) for n in names}
    # 모자·안경 크기 기준. 머리 높이는 방향마다 턱을 재는 곳(주둥이 아래·몸 비율)이 달라 흔들리니,
    # 몸 높이에 정면 대표(서기 stand-down, 앉기 idle-down)의 머리 높이 비율을 곱해 모든 방향에서 같은 크기로 쓴다
    for lm in lms.values():
        front_ref = lms["idle-down" if lm["group"].startswith("sit") else "stand-down"]
        lm["head_scale"] = (lm["bot"] - lm["top"]) * front_ref["head"]["ry"] * 2 / (front_ref["bot"] - front_ref["top"])
    # 눈을 못 찾은 스프라이트(감은 눈 등)는 같은 묶음 대표 스프라이트의 눈 자리를 머리 기준으로 옮겨 쓴다
    for lm in lms.values():
        ref = lms[REFERENCE[lm["group"]]]
        if lm["eyes"] or not ref["eyes"] or lm["view"] in ("back", "back3q"):
            continue
        scale = lm["head_scale"] / ref["head_scale"]
        sign = -1 if lm["flip"] != ref["flip"] else 1
        lm["eyes"] = [dict(cx=lm["head"]["cx"] + sign * (e["cx"] - ref["head"]["cx"]) * scale, cy=lm["top"] + (e["cy"] - ref["top"]) * scale,
                           w=e["w"] * scale, box=e["box"]) for e in ref["eyes"]]
    fits: dict[str, dict[str, list]] = {}
    for slot, item_id, _ in items():
        if slot == "onepiece":
            make_fill(item_id)
        key = f"{slot}/{item_id}"
        fits[key] = {}
        for group, ref in REFERENCE.items():
            fits[key][group] = fit_item(slot, item_id, lms[ref], lms["stand-down"])
        print(key, flush=True)
    sprites = {n: sprite_record(lm) for n, lm in lms.items()}
    body = (
        "// 생성 파일 — 고치지 말고 `python scripts/wardrobe_fit.py` 로 다시 만든다\n"
        "// SPRITE_FIT: 스프라이트(capybara-<이름>.webp)마다 옷 그림 방향·맞추기 묶음·좌우 반전, 머리 타원 [cx, cy, rx, ry],\n"
        "//   칸별 기준점 [cx, y, w] (이미지 %; hat 은 머리 꼭대기, glasses 는 두 눈, top 은 몸통(한벌옷))\n"
        "// ITEM_FIT: 옷(<칸>/<id>)마다 묶음별, 기준점마다 상자 [dx, dy, w, h] — 기준점 폭 단위, dx 는 오른쪽 보기 기준\n"
        'import type { FitGroup, FitRel, SpriteFit } from "./wardrobe";\n\n'
        f"export const SPRITE_FIT: Record<string, SpriteFit> = {json.dumps(sprites, separators=(',', ':'))};\n\n"
        f"export const ITEM_FIT: Record<string, Partial<Record<FitGroup, readonly FitRel[]>>> = {json.dumps(fits, separators=(',', ':'))};\n"
    )
    OUT.write_text(body, encoding="utf-8")
    print(f"{OUT.relative_to(ROOT)}: 스프라이트 {len(sprites)}장, 옷 {len(fits)}벌")


# ---------- 확인 시트 (wardrobe.ts placeOutfit 과 같은 계산) ----------

def placements(sprite: dict, outfit: dict[str, str]) -> list[tuple[str, Path, float, float, float, float, bool]]:
    ts = OUT.read_text(encoding="utf-8")
    item_fit = json.loads(re.search(r"export const ITEM_FIT[^=]*= (\{.*\});", ts).group(1))
    anchors = {"hat": "hat", "glasses": "glasses", "onepiece": "top"}
    out = []
    for slot in ["onepiece", "glasses", "hat"]:
        item_id = outfit.get(slot)
        rels = item_fit.get(f"{slot}/{item_id}", {}).get(sprite["group"]) if item_id else None
        if not rels:
            continue
        for index, (cx, y, w) in enumerate(sprite[anchors[slot]]):
            dx, dy, rw, rh = rels[min(index, len(rels) - 1)]
            sign = -1 if sprite["flip"] else 1
            mirror = sprite["flip"]
            path = fill_path(item_id, sprite["view"]) if slot == "onepiece" else art_path(slot, item_id, sprite["view"])
            out.append((slot, path, cx + sign * dx * w, y + dy * w, rw * w, rh * w, mirror))
    return out


def dress(name: str, sprite: dict, outfit: dict[str, str], size: int) -> Image.Image:
    base = Image.open(CAPY / f"capybara-{name}.webp").convert("RGBA").resize((size, size), Image.LANCZOS)
    canvas = base.copy()
    head_drawn = False

    def redraw(ellipses):
        mask = Image.new("L", (size, size), 0)
        for ellipse in ellipses:
            cx, cy, rx, ry = (v * size / 100 for v in ellipse)
            ImageDraw.Draw(mask).ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=255)
        part = Image.new("RGBA", (size, size))
        part.paste(base, (0, 0), Image.composite(base.getchannel("A"), Image.new("L", (size, size)), mask))
        canvas.alpha_composite(part)

    def draw_head():
        # dressSprite 와 같이 한벌옷을 입었으면 한벌옷 다음에 발·머리를 다시 그린다
        if any(s in outfit for s in BODY_SLOTS):
            redraw([*sprite["feet"], sprite["head"]])

    for slot, path, x, bottom, w, h, mirror in placements(sprite, outfit):
        if slot in ("glasses", "hat") and not head_drawn:
            head_drawn = True
            draw_head()
        art = Image.open(path).convert("RGBA").resize((max(1, round(w * size / 100)), max(1, round(h * size / 100))), Image.LANCZOS)
        if mirror:
            art = art.transpose(Image.FLIP_LEFT_RIGHT)
        position = (round((x - w / 2) * size / 100), round((bottom - h) * size / 100))
        layer = Image.new("RGBA", (size, size))
        layer.paste(art, position, art)
        if slot == "onepiece":  # 로비의 source-atop 과 같이 스프라이트 윤곽 안에만
            layer.putalpha(ImageChops.multiply(layer.getchannel("A"), base.getchannel("A")))
        canvas.alpha_composite(layer)
    if not head_drawn:
        draw_head()
    return canvas


SHEET_OUTFITS = [
    {"onepiece": "overalls", "hat": "beanie", "glasses": "wood"},
    {"onepiece": "dino", "hat": "crown", "glasses": "star"},
    {"onepiece": "raincoat", "hat": "straw", "glasses": "goggles"},
    {"onepiece": "yukata", "hat": "watermelon", "glasses": "heart"},
    {"onepiece": "strawberry", "hat": "leaf", "glasses": "rainbow"},
    {"onepiece": "shark", "hat": "yuzu-towel", "glasses": "sunglasses"},
]
SHEET_SPRITES = ["stand-down", "stand-down-right", "stand-right", "stand-up-right", "stand-up", "stand-left", "walk1-down", "walk2-right",
                 "punch-down", "punch-right", "yawn-2-down", "doze-2-right", "scratch-2", "eating-1", "idle-down", "idle-right", "idle-up"]


def sheet(args: list[str]) -> None:
    ts = OUT.read_text(encoding="utf-8")
    sprites = json.loads(re.search(r"export const SPRITE_FIT[^=]*= (\{.*\});", ts).group(1))
    outfits = [json.loads(a) for a in args if a.startswith("{")] or SHEET_OUTFITS
    names = [a for a in args if a in sprites] or SHEET_SPRITES
    t = 200
    canvas = Image.new("RGBA", (t * len(names), t * len(outfits)), (60, 90, 50, 255))
    for r, outfit in enumerate(outfits):
        for c, name in enumerate(names):
            canvas.alpha_composite(dress(name, sprites[name], outfit, t), (c * t, r * t))
    path = ROOT / "scripts/make_image/assets/wardrobe-fit-sheet.png"
    path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(path)
    print(path)


if __name__ == "__main__":
    if sys.argv[1:2] == ["sheet"]:
        sheet(sys.argv[2:])
    else:
        build()
