"""Codex CLI의 이미지 생성 기능으로 에셋을 만들어 make_image/assets 에 투명 배경 PNG로 저장한다."""

import re
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

ASSETS_DIR = Path(__file__).parent / "assets"


def make_image(prompt: str, name: str, refs: list[str] | None = None, transparent: bool = True) -> Path:
    codex = shutil.which("codex")
    if not codex:
        raise RuntimeError("codex CLI를 찾을 수 없습니다 (npm i -g @openai/codex)")

    ASSETS_DIR.mkdir(exist_ok=True)
    out = ASSETS_DIR / f"{name}.png"
    instruction = (
        f"이미지 생성 도구로 아래 설명의 이미지를 만들고, PNG 파일로 정확히 이 경로에 저장해: {out}\n"
        "코드로 그리지 말고 반드시 이미지 생성 도구를 사용해. 배경은 투명 또는 단색 한 가지로.\n"
        "마지막 답변에는 생성된 원본 이미지 파일의 절대 경로를 반드시 적어.\n\n"
        f"{prompt}"
    )

    with tempfile.TemporaryDirectory() as tmp:
        last_message = Path(tmp) / "last.txt"
        cmd = [codex, "exec", "--skip-git-repo-check", "-s", "workspace-write", "-C", str(ASSETS_DIR), "-o", str(last_message)]
        for ref in refs or []:
            cmd += ["-i", str(Path(ref).resolve())]
        # 프롬프트는 stdin("-")으로 넘긴다: -i 뒤 인자 흡수, Windows .cmd 인자 깨짐(한글/줄바꿈) 회피
        cmd.append("-")
        subprocess.run(cmd, input=instruction, text=True, encoding="utf-8", check=True)

        # Codex 샌드박스 셸이 복사에 실패할 때가 있어, 답변에 적힌 생성 원본 경로에서 직접 가져온다
        if not out.exists():
            text = last_message.read_text(encoding="utf-8") if last_message.exists() else ""
            found = [Path(p) for p in re.findall(r"[A-Za-z]:\\[^`\s*]+?\.png", text) if Path(p).exists()]
            if not found:
                raise RuntimeError(f"Codex가 {out} 을 만들지 않았습니다. 위 Codex 출력을 확인하세요")
            shutil.copy(found[-1], out)

    # 바닥 텍스처처럼 화면을 꽉 채우는 이미지는 모서리 색을 배경으로 오인해 지우면 안 된다
    if transparent:
        remove_background(out)
    return out


def remove_background(path: Path, tolerance: int = 60) -> None:
    """네 모서리에서 이어진 단색 배경을 투명하게 만든다. 이미 투명하면 그대로 둔다."""
    image = Image.open(path).convert("RGBA")
    if image.getpixel((0, 0))[3] == 0:
        return
    # ponytail: 모서리 flood fill 이라 털 가장자리에 배경색 테두리가 조금 남을 수 있음. 거슬리면 rembg 같은 누끼 모델로 교체
    rgb = image.convert("RGB")
    filled = rgb.copy()
    w, h = filled.size
    for corner in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        ImageDraw.floodfill(filled, corner, (255, 0, 255), thresh=tolerance)
    changed = ImageChops.difference(rgb, filled).convert("L").point(lambda v: 255 if v else 0)
    image.putalpha(ImageChops.subtract(image.getchannel("A"), changed))
    image.save(path)
