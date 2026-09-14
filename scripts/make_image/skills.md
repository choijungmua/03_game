# make_image — 카피바라 에셋 제작 가이드

ggpli의 모든 카피바라 에셋은 **기본 카피바라 이미지(idle 4방향)를 참고 이미지로 넣어** Codex로 제작한다.
새 포즈·표정·걷기 프레임을 만들 때 원본 캐릭터에서 벗어나지 않게 하는 것이 목적이다.

## 기본 카피바라 이미지

| 방향 | 원본 PNG (1024×1024) | 게임용 WebP (512×512) |
|---|---|---|
| 위(뒷모습) | `assets-src/characters/capybara/capybara-idle-up.png` | `public/assets/images/characters/capybara/capybara-idle-up.webp` |
| 아래(정면) | `assets-src/characters/capybara/capybara-idle-down.png` | `public/assets/images/characters/capybara/capybara-idle-down.webp` |
| 왼쪽 | `assets-src/characters/capybara/capybara-idle-left.png` | `public/assets/images/characters/capybara/capybara-idle-left.webp` |
| 오른쪽 | `assets-src/characters/capybara/capybara-idle-right.png` | `public/assets/images/characters/capybara/capybara-idle-right.webp` |

게임 코드에서는 `/assets/images/characters/capybara/capybara-idle-down.webp` 처럼 WebP를 쓴다.

## 대각선 걷기 · 로비 UI

- 대각선 걷기: `capybara-{stand,walk1,walk2}-{up-left,up-right,down-left,down-right}` — 방향마다 시트 1장(해당 상하 + 좌우 stand 이미지를 참고로)에서 잘라 stand/walk와 같은 크기·정렬로 맞춘다. 없으면 로비가 좌우 옆모습으로 대신한다
- 로비 UI: `public/assets/images/ui/lobby/{punch,sit,joystick-base,joystick-knob}.webp` (256×256, 원본 `assets-src/ui/lobby/`) — 나무 테·펠트 판 버튼(주먹 앞발, 통나무 의자), 나무 고리 조이스틱 바닥, 카피바라 발바닥 손잡이. 시트 1장에서 자름
- 로비 UI `bag.webp`: 오른쪽 위 낚시 가방 버튼 — 같은 나무 테·펠트 판 위 카피바라 얼굴 백팩(잎 단추). `sit.png`·`capybara-idle-down.png`를 참고로 넣고 마젠타 배경으로 한 장 생성 → 마젠타 지우고 가장자리까지 잘라 256 WebP. 새 버튼 그림도 이 방식으로 톤을 맞춘다
- 로비 UI `fish.webp`: 물가에서 뜨는 낚시 버튼 — 같은 나무 테·펠트 판 위 나무 낚싯대(빨강·흰 찌)를 든 카피바라 상반신. `punch.png`·`capybara-idle-down.png`를 참고로 위와 같은 방식으로 생성

## 서서 걷기 (walk) 이미지

방향마다 3프레임 × 4방향 = 12장. 사용 예: `app/page.tsx` (방향키 8방향 걷기)

- `capybara-stand-<방향>`: 두 발로 서 있음
- `capybara-walk1-<방향>`, `capybara-walk2-<방향>`: 한 발 / 반대 발 내딛음
- 재생 순서: `walk1 → stand → walk2 → stand` 반복 (프레임당 130ms). 대각선은 좌·우 옆모습 사용
- 원본 시트: `assets-src/characters/capybara/sheets/capybara-walk-sheet-<방향>.png`
- 게임용 WebP는 384×384 (화면 표시 최대 120px). `next/image`에는 `unoptimized`를 준다 — 최적화 서버가 재인코딩하면 투명 배경이 깨진다

**프레임 일관성 팁:** 프레임을 한 장씩 따로 생성하면 크기·색이 프레임마다 달라져 애니메이션이 떨린다. 3프레임을 **가로 한 장의 시트로 한 번에 생성**한 뒤 잘라 쓴다 (시트 안 3프레임은 같은 배율로 줄이고, 발바닥 높이·머리 중심을 맞춤).

## 때리기·기절 이미지

- `capybara-punch-<방향>`: 바라보는 방향으로 주먹 뻗기 (4방향, 원본 시트 1장에서 자름)
- `capybara-stun`: 정면, 소용돌이 눈으로 비틀거림 (머리 위 별은 코드로 그림)
- 크기·정렬은 stand/walk와 같음 (1024 캔버스, 캐릭터 높이 900, 발바닥 y=1000, 384 WebP)

## 로비 에셋

테마는 **카피바라 온천 습지 마을** (카피바라가 사는 남미 강가 습지 + 일본 동물원 카피바라 유자 온천).
카피바라 인형과 같은 털·펠트 봉제인형 질감 3D 미니어처, 약간 위에서 본 3/4 시점, 투명 배경

**에셋 하나 = 폴더 하나.** 분류(`ground` 바닥 텍스처 · `nature` 자연물 · `props` 마을 소품 · `buildings` 오두막)마다 에셋 id 폴더를 둔다

```
lib/lobby/assets/<분류>/<id>/index.ts              # 정의: 그릴 폭(타일)·바닥 보정(px)·대체 색
public/assets/images/lobby/<분류>/<id>/image.webp  # 게임용 이미지
assets-src/lobby/<분류>/<id>/source.png            # 생성 원본
```

새 로비 에셋 추가: 위 세 파일을 만들고 `lib/lobby/assets/index.ts` 레지스트리 배열에 한 줄 추가 (오두막은 `BUILDING_ASSETS`에 넣으면 종류가 자동으로 늘어난다). `lib/lobby/assets/assets.test.ts`가 이미지 누락·id 중복을 잡는다

- `props/onsen`: 이끼 돌 테두리 유자 온천 (김은 코드로 그림)
- `props/log-seat`, `props/lantern`, `nature/reeds`, `nature/grass-bush`, `nature/rocks`: 소품 시트 1장에서 자름
- `props/guestbook-board`: 방명록 게시판 (나무 기둥 두 개·잎사귀 지붕, 잎 쪽지를 나무 핀으로 꽂은 판, 글자 없음). `capybara-idle-down.png`·`props/lantern/source.png`를 참고로 마젠타 배경 한 장 생성 → 배경 지우고 가장자리까지 잘라 긴 변 384 WebP. 로비 가운데 데크 갈래길 옆, 앞에서 Space로 방명록을 연다
- `nature/tree-tropical`, `nature/palm`, `props/fence`(갈대 울타리), `nature/lotus`, `nature/banana-bush`: 자연 시트 1장에서 자름. 붙어 있는 소품은 알파 연결 요소(flood fill)로 나눈다
- `buildings/hut-{1,2,3}`: 게임 오두막 3종 (1 초가 원두막+나무 아케이드 간판, 2 카피바라 귀 풀 굴집+나무 휴대용 게임기 간판, 3 바나나잎 대나무 원두막+나무 TV 간판). 간판 화면은 이미지에서 비워 두고, 화면 위치(이미지 대비 비율)를 정의의 `screen`에 적는다 — 로비가 그 자리에 게임 아이콘을 그린다
- 게임 아이콘: `public/assets/images/games/<slug>/icon.webp` (원본 `assets-src/games/<slug>/icon.png`) — 오두막 간판 화면에 켜지는, 그 게임을 알리는 소품 하나. 로비에서 게임을 알리는 표시는 이것 하나뿐이다. 작은 화면에 들어가므로 굵고 단순한 실루엣, 생성 배경은 마젠타(#FF00FF) 단색(검은 조약돌·어두운 나무가 배경 제거에 안 먹히게). 마을 테마에 맞게 나무·잎사귀·조약돌·코코넛 같은 자연 소재 + 펠트 질감 (반응속도=나무 스톱워치, 클릭=나무·이끼 마우스, 몰래 먹기=잎 접시 위 수박, 슈팅=나무·대나무 비행기, 바둑=코코넛 그릇 조약돌, 오목=통나무 판 조약돌, 알까기=통나무 판 위 튕기는 조약돌). 투명 배경, 가장자리까지 자른 뒤 384px 이하. 없으면 아이콘 없이 오두막만 보인다
- 이전 포털 에셋은 `assets-src/lobby/_archive-portal/`에 보관 (사용 안 함)
- `ground/{meadow,mud,water,deck}`: 192×192 바닥 텍스처 (2×2 시트 1장 → 칸마다 반 칸 밀어 가장자리 블렌딩, 데크는 판자 줄이라 그대로). 월드 192px(4타일)마다 반복
- 이전 영국 광장 에셋은 `assets-src/lobby/_archive-british-square/`에 보관 (사용 안 함)

**화풍 일치:** 로비 에셋은 카피바라 기준이다. 새로 만들 때 `assets-src/characters/capybara/capybara-idle-down.png`를 참고 이미지(`-i`)로 넣고 프롬프트에 "첨부 카피바라 인형과 같은 털·펠트 봉제인형 질감"을 적는다. 도시·석조·네온처럼 카피바라가 살지 않을 곳의 소재는 쓰지 않는다

**바닥 텍스처처럼 화면을 꽉 채우는 이미지는 `--keep-background`** — 안 주면 모서리 색을 배경으로 알고 지워 버린다

## 파비콘

- 카피바라 정면 얼굴(점 1개 규칙 동일). 원본 `assets-src/favicon/source.png` (1024, 가장자리까지 자르고 2% 여백)
- Next 파일 규칙으로 자동 연결 — `layout.tsx` 수정 없음: `app/favicon.ico` (16·32·48), `app/icon.png` (512), `app/apple-icon.png` (180). PNG는 256색 양자화로 용량 줄임

## 대기 동작 이미지 (가만히 서 있을 때)

- `capybara-scratch-{1,2,3}`: 뒷모습, 1 앞발을 엉덩이에 댐 → 2 위로 긁기 → 3 아래로 긁기
- `capybara-yawn-{1,2,3}-{up,down,left,right}`: 바라보는 방향별, 1 입 벌리기 시작 → 2 크게 하품하며 두 앞발로 기지개 → 3 개운하게 입 다묾
- `capybara-doze-{1,2}-{up,down,left,right}`: 바라보는 방향별, 눈 감고 꾸벅 → 더 깊이 꾸벅. 흔들림은 코드로
- 방향마다 시트 1장(하품 3 + 졸기 2 = 5프레임, 참고 이미지는 그 방향 `capybara-stand-<방향>.png`)에서 자른다. 대각선은 가까운 좌우를, 방향 이미지가 없으면 정면(`-down`)을 쓴다
- 크기·정렬은 stand와 같음. 배율은 첫 프레임(보통 자세) 기준으로 모든 프레임 같게 — 기지개처럼 키가 커지는 프레임도 발바닥 높이 유지
- 로비는 3.5초 쉬고 긁기(2.2초) → 3.5초 쉬고 하품(2초) → 3.5초 쉬고 졸기(3초)를 반복 (`IDLE_ACTIONS`)

## 통나무에서 잠든 이미지

- `capybara-sleep-{1,2}`: 정면으로 앉아 잠든 모습. 1 눈 감고 새근새근 → 2 콧방울. 로비는 통나무에 30분(`SLEEP_AFTER_MS`) 넘게 앉아 있으면 1.4초마다 번갈아 그리고, 숨쉬기(세로로 살짝 부풀기)와 머리 옆 z는 코드로 그린다
- 앉은 정면(`capybara-idle-down`)과 같은 자세·크기·정렬이어야 옷이 앉은 정면 자리(`SLOT_INFO`)에 맞는다. 원본 시트 `assets-src/characters/capybara/sheets/capybara-sleep-sheet.png`(마젠타 배경, 2칸)에서 두 칸을 같은 배율로 잘라 idle-down 캐릭터 상자에 맞췄다

## 옷장 방향별 옷 그림

- 옷장 정면 그림: `public/assets/images/characters/capybara/wardrobe/<slot>/<id>.webp` (시트 3칸 → `scripts/split_wardrobe.py`)
- 상의·하의·한벌옷·신발·장갑은 로비 맵 방향마다 따로 그린 그림을 쓴다: `<id>-{back,side,front3q,back3q}.webp`. 옆·대각선은 오른쪽을 향한 그림(왼쪽은 코드가 반전), 신발·장갑은 한 짝만
- 새 옷을 추가하면 `python scripts/wardrobe_views.py gen slot/id` (정면 그림 + 서기 스프라이트 4방향을 참고로 가로 4칸 시트 생성) → `python scripts/wardrobe_views.py split`. 원본 시트는 `assets-src/characters/capybara/wardrobe/views/`
- 자리는 `lib/lobby/wardrobe.ts`의 `WORLD_ANCHORS` (폭·높이 상자에 비율 유지로 넣음). `lib/lobby/wardrobe.test.ts`가 방향별 그림 누락을 잡는다
- 동시 생성은 2개까지 (많이 돌리면 PC 메모리 부족으로 죽는다). Codex 사용량 한도에 걸리면 안내된 시각 이후 `gen`을 다시 돌리면 이미 만든 시트는 건너뛴다

## 먹이 먹기 이미지

- `capybara-eating-{1,2}`: 정면, 두 앞발을 턱 아래에 모으고 1 입 크게 벌려 베어 묾 → 2 입 다물고 눈 감고 오물오물. 앞발 사이 먹이(낚은 것 그림)와 머리 위 하트는 로비 코드가 그린다 (`app/_lobby/lobby.tsx` `drawFood`·`drawHearts`, 먹이 높이 `FOOD_Y`)
- 시트 1장(`assets-src/characters/capybara/sheets/capybara-eating-sheet.png`, 마젠타 배경, 참고 `capybara-stand-down.png` + `capybara-idle-down.png`)에서 자름. 마젠타는 make_image가 못 지워서 초록 대비 빨강·파랑 차이로 알파를 만들고 가장자리 분홍 번짐을 뺐다
- 크기·정렬은 stand와 같음 (1024 캔버스, 캐릭터 높이 900, 발바닥 y=1000, 384 WebP). 두 프레임 같은 배율

## 약관 읽기 이미지

- `capybara-reading-{right,left}`: 앉아서 나무테 안경을 쓰고 종이를 읽으며 연필로 가리킴. 방향은 바라보는 쪽 — 이용약관·개인정보처리방침·문의 페이지(`app/_legal/legal-page.tsx`)에서 `right`는 종이 왼편, `left`는 오른편
- 두 마리를 시트 1장(`assets-src/characters/capybara/sheets/capybara-reading-sheet.png`, 마젠타 배경)에서 한 번에 생성해 잘랐다. 좌우 반전으로 만들면 얼굴 점이 반대로 가니 반전하지 않는다
- 크기·정렬은 stand와 같음 (1024 캔버스, 발바닥 아래 정렬, 384 WebP)

## 캐릭터 규칙 (생성 후 반드시 확인)

- 털 질감 3D 봉제인형 렌더, 기본 idle 4장과 같은 털색·밝기 (주황빛 과하지 않게)
- **얼굴의 점은 딱 하나**: 캐릭터 기준 오른쪽 눈(정면에서 볼 때 화면 왼쪽 눈)의 바깥 위
  - 정면: 화면 왼쪽 눈 옆에 점 1개 / 오른쪽 옆모습: 눈 바깥쪽에 점 1개 / 왼쪽 옆모습·뒷모습: 점 없음
  - 이미지 생성이 점을 2개 그리거나 반대편에 그리는 일이 잦다 — 확대해서 확인하고, 틀리면 다시 만들거나 주변 털로 덮어 지운다
- 볼터치, 짧은 눈썹, 갈색 주둥이·귀·발
- 배경은 투명. 생성 결과에 체크무늬(투명 표시 격자)가 그려져 있으면 다시 만든다

## 네이밍

`capybara-<상태>-<방향>` (kebab-case)

- 상태: `idle`, `walk1`, `walk2`, `eating`, `caught`, `happy`, `sad` …
- 방향: `up`, `down`, `left`, `right` (방향이 없는 컷이면 생략: `capybara-eating`)
- 공용 캐릭터 에셋은 `characters/capybara/`, 특정 게임 전용 컷은 `games/<slug>/capybara/`

## 사용 방법

`scripts` 폴더에서 실행한다. 결과는 `scripts/make_image/assets/<name>.png` (투명 배경 PNG).

```powershell
cd scripts

# 기본 이미지 한 장을 참고로 새 포즈 만들기
python -m make_image "참고 이미지와 완전히 같은 카피바라. 방향: 아래(정면). 수박을 두 앞발로 들고 먹는 모습. 전신이 화면 가운데, 정사각형, 배경은 순수 검정 단색(체크무늬 금지). 얼굴의 점은 화면 왼쪽 눈 옆에 딱 하나." -n capybara-eating-down -i ../assets-src/characters/capybara/capybara-idle-down.png

# 옆모습은 해당 방향 idle + 정면 idle 을 같이 넣으면 색·얼굴이 더 잘 맞는다
python -m make_image "첫 번째 참고 이미지와 같은 방향·색의 카피바라. 오른쪽으로 걷는 첫 프레임(왼발 앞). 배경은 순수 검정 단색." -n capybara-walk1-right -i ../assets-src/characters/capybara/capybara-idle-right.png -i ../assets-src/characters/capybara/capybara-idle-down.png
```

옵션
- `prompt` (필수): 만들 이미지 설명
- `-n, --name` (필수): 파일 이름, 확장자 제외
- `-i, --image` (여러 번 가능): 참고 이미지 경로

스크립트가 알아서 하는 일
- `codex exec` 실행 (프롬프트는 stdin 전달 — Windows에서 한글·줄바꿈 깨짐 방지)
- Codex가 `assets/`로 복사를 못 하면 답변에 적힌 생성 원본 경로(`~/.codex/generated_images/…`)에서 가져옴
- 네 모서리에서 이어진 단색 배경을 투명 처리 (털 가장자리에 배경색이 약간 남을 수 있음)

## 생성 후 정리 절차

1. 결과를 확대해서 위 **캐릭터 규칙**(점 1개, 색, 체크무늬) 확인
2. idle 4장과 크기·위치 맞추기: 캐릭터 영역을 잘라 높이 920px로 줄이고 1024×1024 투명 캔버스 가운데·아래 정렬
3. 원본 PNG를 `assets-src/…`로 옮기고, 512×512 WebP(quality 90)로 변환해 `public/assets/images/…`에 넣기

```powershell
python -c "
from PIL import Image
im = Image.open('scripts/make_image/assets/capybara-eating-down.png').convert('RGBA')
im = im.crop(im.getchannel('A').point(lambda v: 255 if v > 16 else 0).getbbox())
im = im.resize((round(im.width * 920 / im.height), 920), Image.LANCZOS)
canvas = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
canvas.alpha_composite(im, ((1024 - im.width) // 2, 1024 - 920 - 52))
canvas.save('assets-src/characters/capybara/capybara-eating-down.png')
canvas.resize((512, 512), Image.LANCZOS).save('public/assets/images/characters/capybara/capybara-eating-down.webp', 'WEBP', quality=90, method=6)
"
```

실제 이미지 생성은 연결된 OpenAI 계정 사용량을 쓴다. 한 장당 수 분 걸리고, 여러 장은 터미널을 나눠 동시에 돌려도 된다.
