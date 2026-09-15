"""사진 같은 바닥 텍스처를 카피바라 펠트 톤으로 바꾼다: 잔 디테일 제거 → 대비 낮춤 → 털 결 노이즈.
원본 assets-src/lobby/ground/<id>/source.png → public/assets/images/lobby/ground/<id>/image.webp (192×192)
3×3로 이어 붙여 처리한 뒤 가운데를 잘라서 반복 이음매가 그대로 이어진다

ponytail: 이미지 처리 보정이다. 펠트 바닥을 make_image로 새로 생성하면(skills.md "펠트 통일 재생성") 이 스크립트는 지운다
"""

import random
from pathlib import Path

from PIL import Image, ImageChops, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parent.parent

# id: (중앙값 필터 크기, 흐림 반경, 원래 무늬를 남기는 비율, 채도, 밝기 상한)
SPEC = {
    "meadow": (9, 2.0, 0.45, 0.85, 235),
    "mud": (9, 2.0, 0.5, 0.9, 235),
    "water": (5, 2.5, 0.8, 1.05, 205),
    "deck": (7, 1.2, 0.6, 0.9, 235),
}


def tiled(image: Image.Image, fn) -> Image.Image:
    w, h = image.size
    big = Image.new(image.mode, (w * 3, h * 3))
    for i in range(3):
        for j in range(3):
            big.paste(image, (i * w, j * h))
    return fn(big).crop((w, h, w * 2, h * 2))


def fiber_noise(size: int, seed: int) -> Image.Image:
    rnd = random.Random(seed)
    noise = Image.new("L", (size, size))
    noise.putdata([128 + rnd.randint(-40, 40) for _ in range(size * size)])
    return tiled(noise, lambda im: im.filter(ImageFilter.GaussianBlur(0.8))).convert("RGB")


for seed, (name, (median, blur, keep, saturation, cap)) in enumerate(SPEC.items()):
    image = Image.open(ROOT / f"assets-src/lobby/ground/{name}/source.png").convert("RGB").resize((384, 384), Image.LANCZOS)
    image = tiled(
        image,
        lambda big: Image.blend(
            big.filter(ImageFilter.GaussianBlur(24)),
            big.filter(ImageFilter.MedianFilter(median)).filter(ImageFilter.GaussianBlur(blur)),
            keep,
        ),
    )
    image = ImageEnhance.Color(image.point(lambda v: min(v, cap))).enhance(saturation)
    # 128 기준으로 밝기만 살짝 흔들어 털 결을 입힌다
    image = ImageChops.add(image, fiber_noise(384, seed), offset=-128)
    image.resize((192, 192), Image.LANCZOS).save(ROOT / f"public/assets/images/lobby/ground/{name}/image.webp", "WEBP", quality=90, method=6)
    print(name)
