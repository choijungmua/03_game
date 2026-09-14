import argparse

from make_image import make_image

parser = argparse.ArgumentParser(prog="python -m make_image", description="Codex로 이미지 에셋 생성")
parser.add_argument("prompt", help="만들 이미지 설명")
parser.add_argument("-n", "--name", required=True, help="저장할 파일 이름 (확장자 제외, 예: stone-black)")
parser.add_argument("-i", "--image", action="append", dest="refs", help="참고 이미지 경로 (여러 번 지정 가능)")
parser.add_argument("--keep-background", action="store_true", help="배경 투명 처리를 건너뜀 (바닥 텍스처 등)")
args = parser.parse_args()

print(make_image(args.prompt, args.name, args.refs, transparent=not args.keep_background))
