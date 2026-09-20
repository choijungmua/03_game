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
- 로비 UI `{wardrobe,sound,profile}.webp`: 오른쪽 세로줄 옷장·효과음·이름 바꾸기 버튼 — 가방과 같은 나무 테·펠트 판 위에 각각 나무 옷걸이에 걸린 잎 단추 펠트 셔츠 / 눈 감고 음악 듣는 카피바라 + 잎 음표(헤드폰은 코드가 씌움) / 빈 나무 이름표를 목에 건 카피바라. `bag.png`·`capybara-idle-down.png`를 참고로 가로 3칸 시트 한 장(마젠타 배경) 생성 → 마젠타를 초록 대비 빨강·파랑 차이로 지우고 칸마다 잘라 256 WebP (원본 `assets-src/ui/lobby/{wardrobe,sound,profile}.png`)
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
- `props/fence-vertical`(세로 울타리: 기둥 + 한 칸 아래로 이어지는 엮은 판), `props/fence-post`(모서리 기둥): `props/fence/source.png`를 참고로 새로 그렸다(`emoji-fence-vertical` 시트 한 장에서 기둥 + 판, 기둥만 두 벌로 잘라 쓴다 — 기둥이 서로 다르게 보이지 않는다). 그림 비율이 바뀌면 정의의 `width`·`offsetY`를 다시 맞춰야 기둥이 제 칸 바닥에 선다
- `nature/tree-tropical`, `nature/palm`, `props/fence`(갈대 울타리), `nature/lotus`, `nature/banana-bush`: 자연 시트 1장에서 자름. 붙어 있는 소품은 알파 연결 요소(flood fill)로 나눈다
- `buildings/hut-{1,2,3}`: 게임 오두막 3종 (1 초가 원두막+나무 아케이드 간판, 2 카피바라 귀 풀 굴집+나무 휴대용 게임기 간판, 3 바나나잎 대나무 원두막+나무 TV 간판). 간판 화면은 이미지에서 비워 두고, 화면 위치(이미지 대비 비율)를 정의의 `screen`에 적는다 — 로비가 그 자리에 게임 아이콘을 그린다
- 게임 아이콘: `public/assets/images/games/<slug>/icon.webp` (원본 `assets-src/games/<slug>/icon.png`) — 오두막 간판 화면에 켜지는, 그 게임을 알리는 소품 하나. 로비에서 게임을 알리는 표시는 이것 하나뿐이다. 작은 화면에 들어가므로 굵고 단순한 실루엣, 생성 배경은 마젠타(#FF00FF) 단색(검은 조약돌·어두운 나무가 배경 제거에 안 먹히게). 마을 테마에 맞게 나무·잎사귀·조약돌·코코넛 같은 자연 소재 + 펠트 질감 (반응속도=나무 스톱워치, 클릭=나무·이끼 마우스, 몰래 먹기=잎 접시 위 수박, 슈팅=나무·대나무 비행기, 바둑=코코넛 그릇 조약돌, 오목=통나무 판 조약돌, 알까기=통나무 판 위 튕기는 조약돌, 수박 게임=펠트 과일이 소복한 나무 상자, 카피바라 팡=잎 접시 위 동물 얼굴 구슬 세 개). 투명 배경, 가장자리까지 자른 뒤 384px 이하. 없으면 아이콘 없이 오두막만 보인다
- 이전 포털 에셋은 `assets-src/lobby/_archive-portal/`에 보관 (사용 안 함)
- `ground/{meadow,mud,water,deck}`: 192×192 바닥 텍스처 (2×2 시트 1장 → 칸마다 반 칸 밀어 가장자리 블렌딩, 데크는 판자 줄이라 그대로). 월드 192px(4타일)마다 반복. 지금 게임용 이미지는 사진 같던 원본(`source.png`)을 `python scripts/feltify_ground.py`로 펠트 톤으로 보정한 것이다 — 아래 재생성으로 펠트 바닥을 새로 만들면 스크립트는 지운다
- `props/yuzu`: 목욕하는 카피바라 머리에 얹는 유자. `props/onsen/source.png` 속 유자 윗부분을 타원으로 잘랐다
- 이전 영국 광장 에셋은 `assets-src/lobby/_archive-british-square/`에 보관 (사용 안 함)

**화풍 일치:** 로비 에셋은 카피바라 기준이다. 새로 만들 때 `assets-src/characters/capybara/capybara-idle-down.png`를 참고 이미지(`-i`)로 넣고 프롬프트에 "첨부 카피바라 인형과 같은 털·펠트 봉제인형 질감"을 적는다. 도시·석조·네온처럼 카피바라가 살지 않을 곳의 소재는 쓰지 않는다

### 펠트 통일 규칙 (로비 에셋 합격 기준)

기준 그림은 `capybara-idle-down.png`, `buildings/hut-2`, `nature/rocks`, `nature/palm`, `props/log-seat`. 새 에셋은 이 중 카피바라 + 가장 비슷한 것 하나를 참고로 넣고, 생성 뒤 카피바라와 같은 축척으로 나란히 붙여 보고 합격을 정한다

- **소재:** 털·펠트 봉제 원단 하나. 나뭇결 무늬, 밧줄 꼬임, 전구 줄, 금속, 유리 반사, 사진 같은 잔디·흙·물 질감 금지
- **형태:** 통통한 덩어리, 모든 모서리 둥글게, 부품 수 적게. 가는 기둥·계단·대나무 난간 같은 잔 부품 금지
- **시점·조명:** 세워 그리는 그림은 약간 위에서 본 3/4 정면, 부드러운 빛 하나(왼쪽 위). 바닥 텍스처는 수직으로 내려다본 평면(물체·그림자 없음)
- **색:** 따뜻한 중채도. 카피바라 갈색, 이끼 초록, 짚 노랑, 크림 베이지가 기본
- **다양성:** 소재·조명·시점만 통일하고 실루엣·색은 에셋마다 다르게 — 오두막 셋은 hut-1 키 큰 버섯 짚 지붕 / hut-2 곰귀 초록 돔 / hut-3 낮고 넓은 바나나잎 정자처럼 멀리서 실루엣만 봐도 구분돼야 한다
- **그림자:** 그림에 바닥 그림자를 넣지 않는다 — 접지 그림자는 로비 코드(`drawGroundShadow`)가 모든 스프라이트에 똑같이 깐다
- **크기(카피바라 서기 키 약 67px 기준, 정의의 `width`로 맞춤):** 오두막 4~4.5배(약 290px) · 나무 2~2.5배 · 등불·게시판 1.2~1.4배 · 부들 1.4배 · 울타리 0.7배

### 펠트 통일 재생성 (대기 중)

2026-09-15에 Codex 사용량 한도(9/20 12:15 해제)로 못 만든 것. 한도가 풀리면 `scripts`에서 아래를 두 개씩 돌리고, 결과를 위 규칙으로 확인한 뒤 각 에셋 폴더(`assets-src/lobby/<분류>/<id>/source.png`, 게임용 WebP 긴 변 672(오두막)·384(소품))에 넣는다. 오두막은 간판 화면 비율 `screen`을 새로 재고, 폭 `width`는 높이 약 290px가 되게 다시 맞춘다

```powershell
cd scripts
$CAPY = "../assets-src/characters/capybara/capybara-idle-down.png"
$HUT2 = "../assets-src/lobby/buildings/hut-2/source.png"

# 1) hut-1: 키 큰 버섯 짚 지붕 + 아케이드 간판
python -m make_image "게임 오두막 한 채. 첫 번째 참고 이미지 카피바라 인형과 같은 부드러운 털·펠트 봉제인형 질감의 3D 미니어처 렌더. 두 번째 참고 이미지(곰귀 풀 굴집)와 같은 화풍·부드러운 조명(왼쪽 위)·시점(약간 위에서 내려다본 3/4 정면)·통통하고 둥근 덩어리감으로 같은 마을 건물처럼 보여야 한다. 하지만 모양·색은 확실히 달라야 한다: 키가 조금 큰 둥근 원통형 몸통(크림빛 베이지 펠트 벽) 위에 크고 볼록한 버섯 모자 모양의 짚색 노란 펠트 초가 지붕(가장자리가 둥글게 말려 내려옴, 꼭대기에 작은 잎 두 장). 정면 가운데 둥근 아치 문(안은 따뜻한 주황 빛, 작은 펠트 아케이드 게임기 실루엣 하나), 문 옆 동그란 창 하나. 지붕 앞쪽 위에 둥근 모서리 펠트 나무 아케이드 게임기 간판(빨간 동그란 조이스틱 하나와 동그란 버튼 세 개, 가운데 화면은 비어 있는 짙은 갈색 단색 사각형 — 글자·그림·빛 없음). 발밑에 작은 펠트 풀덤불과 흰 꽃 두세 송이. 금지: 나뭇결 무늬, 밧줄 꼬임, 전구 줄, 계단, 가는 기둥, 대나무, 글자. 부품 적게, 모서리 둥글게. 건물 전체가 가운데에 잘리지 않고, 배경은 순수 마젠타(#FF00FF) 단색(그림자·바닥 없음)." -n felt-hut-1 --keep-background -i $CAPY -i $HUT2

# 2) hut-3: 낮고 넓은 바나나잎 정자 + TV 간판
python -m make_image "게임 오두막 한 채. 첫 번째 참고 이미지 카피바라 인형과 같은 부드러운 털·펠트 봉제인형 질감의 3D 미니어처 렌더. 두 번째 참고 이미지(곰귀 풀 굴집)와 같은 화풍·조명(왼쪽 위)·시점(약간 위에서 내려다본 3/4 정면)·통통한 덩어리감. 모양·색은 확실히 달라야 한다: 가로로 넓고 낮은 한 층 정자. 짧고 아주 통통한 둥근 펠트 기둥 네 개, 둥근 펠트 통나무 단 위에 서 있고, 크고 둥근 밝은 연두 바나나잎 펠트 지붕 두 겹이 부드럽게 늘어진다. 안쪽 둥근 코코넛 갈색 펠트 벽에 둥근 입구(따뜻한 빛, 펠트 게임기 실루엣 하나). 지붕 앞 가운데에 둥근 모서리 펠트 나무 TV 간판(작고 둥근 안테나 두 개, 화면은 비어 있는 짙은 갈색 단색 사각형 — 글자·그림·빛 없음). 양옆에 작은 펠트 바나나잎 덤불. 금지: 대나무, 난간, 가는 기둥, 나뭇결, 밧줄 꼬임, 등불 여러 개, 2층, 글자. 건물 전체가 가운데에 잘리지 않고, 배경은 순수 마젠타(#FF00FF) 단색." -n felt-hut-3 --keep-background -i $CAPY -i $HUT2

# 3) 소품 시트: 울타리·등불·방명록 게시판 (가로 3칸 → 알파 연결 요소로 자름)
python -m make_image "가로로 긴 소품 시트 한 장, 소품 세 개가 서로 떨어져 가로로 나란히. 모두 첫 번째 참고 이미지 카피바라 인형과 같은 털·펠트 봉제인형 질감 3D 미니어처, 두 번째 참고 이미지(통나무 의자)와 같은 화풍·조명(왼쪽 위)·약간 위에서 본 3/4 정면 시점. 통통하고 둥글게, 부품 적게. 금지: 나뭇결 무늬, 밧줄 꼬임, 금속, 유리, 글자, 바닥 그림자. 1) 울타리 한 칸(좌우로 이어 붙여 쓸 수 있게 정면): 통통하고 둥근 머리의 연한 갈대색 펠트 말뚝 두 개 사이에 부드럽고 둥근 펠트 가로대 두 줄, 말뚝에 작은 잎 하나. 2) 등불: 짧고 통통한 둥근 펠트 말뚝 위에 둥근 호롱 모양 펠트 등(안쪽이 따뜻하게 빛남), 폭:높이 약 1:1.8. 3) 방명록 게시판: 짧고 통통한 둥근 말뚝 두 개, 둥근 모서리 크림 펠트 판에 잎 모양 펠트 쪽지 네 장을 둥근 펠트 단추로 꽂음, 위에 둥근 잎 펠트 지붕. 배경은 순수 마젠타(#FF00FF) 단색." -n felt-props-sheet --keep-background -i $CAPY -i ../assets-src/lobby/props/log-seat/source.png

# 4) 바닥 2×2 시트: 왼쪽 위 풀밭, 오른쪽 위 진흙, 왼쪽 아래 물, 오른쪽 아래 데크 → 칸마다 192로 줄이고 반 칸 밀어 이음매 블렌딩
python -m make_image "정사각형 한 장을 2×2 네 칸으로 똑같이 나눈 바닥 텍스처 시트. 위에서 수직으로 내려다본 완전한 평면(원근·물체·그림자 없음), 네 칸 모두 가장자리까지 가득 채우고 칸 사이 선·여백 없음. 소재는 첫 번째 참고 이미지 카피바라 인형과 같은 부드러운 털·펠트 원단 — 사진 같은 잔디·흙·물 반사·나뭇결 금지. 무늬는 크고 부드럽게, 따뜻한 중채도. 왼쪽 위: 짧은 초록 펠트 풀밭(두 번째 참고 이미지 지붕의 이끼 초록). 오른쪽 위: 따뜻한 갈색 펠트 진흙길(작고 둥근 펠트 조약돌 몇 개). 왼쪽 아래: 연둣빛 청록 펠트 물(반사광 없이 부드럽고 둥근 물결 몇 줄). 오른쪽 아래: 가로로 곧게 놓인 둥근 모서리 펠트 판자, 칸 하나에 판자 정확히 4줄, 따뜻한 밝은 갈색." -n felt-ground-sheet --keep-background -i $CAPY -i $HUT2
```

마젠타 배경은 make_image의 모서리 flood fill이 잘 못 지우므로 `--keep-background`로 받고, 초록 대비 빨강·파랑 차이로 알파를 만든다(위 `bag.webp`·먹기 이미지와 같은 방식)

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
- 앉은 정면(`capybara-idle-down`)과 같은 자세·크기·정렬이다 (게임용 AI 그림. 로비는 3D로 구운 그림을 쓴다 — 아래 옷장 참고). 원본 시트 `assets-src/characters/capybara/sheets/capybara-sleep-sheet.png`(마젠타 배경, 2칸)에서 두 칸을 같은 배율로 잘라 idle-down 캐릭터 상자에 맞췄다

## 로비 카피바라 + 옷장 (3D로 굽는다)

로비의 카피바라와 옷은 AI 그림이 아니라 **3D 봉제인형 모델을 구운 스프라이트**다 (`assets-src/characters/capybara-3d/`). 옷이 몸과 같은 뼈에 붙어 있어 어떤 방향·동작에서도 몸을 그대로 따라가고, 몸에 가려지는 부분은 구울 때 이미 지워져 있다. 그래서 로비는 몸 그림 위에 같은 프레임의 옷 칸을 겹치기만 한다 (`lib/lobby/wardrobe.ts` `drawDressed`)

- `rig.js`: 몸(부위 = 뼈에 붙은 덩어리)·얼굴 표정·자세. `frames.js`: 프레임 이름(= 로비 스프라이트 이름) → 방향·자세. `items.js`: 옷 (뼈에 붙는 메시 몇 개. 몸 치수 `BODY`를 부풀린 껍데기·`onHead`로 머리 겉면에 붙이기). `stage.js`: 조명·카메라
- 굽기: `node assets-src/characters/capybara-3d/bake.mjs` (헤드리스 크로미움 + three.js, 약 1분 반) → `public/assets/images/characters/capybara-3d/capybara-<프레임>.webp`(몸 384px) + `wardrobe/<칸>/<id>.webp`(프레임 순서대로 192px 칸을 늘어놓은 시트) + `<id>-icon.webp`(옷장 칸 그림) + `lib/lobby/capybara-3d.ts`(프레임 목록·칸 배치·머리 기준점, 생성 파일)
- 확인: `node assets-src/characters/capybara-3d/bake.mjs preview out.jpg stand-down,stand-right,walk1-left --item onepiece/dino,hat/crown` — 로비와 같은 방식으로 겹친 시트
- 새 옷: `items.js`에 한 항목 + `lib/lobby/wardrobe.ts` `SLOT_INFO`에 이름 → 굽기. 새 동작: `frames.js`에 한 줄 → 굽기 (모든 옷이 같이 구워진다). 새 칸(상의·신발…): `WARDROBE_SLOTS`·`LAYER_ORDER`에 넣는다
- 후드처럼 몸 일부(귀)를 덮는 옷은 `hides: ["ear"]`로 그 부위를 가림막에서 빼고, 귀 주머니를 달아 귀가 옷을 뚫고 나오지 않게 한다
- 겹치는 순서는 한벌옷 → 안경 → 모자. 칸끼리는 서로 가리지 않는다 (옷마다 몸만 가림막으로 구웠기 때문)
- 게임(통나무 피하기 등)은 아직 예전 AI 스프라이트(`characters/capybara/`)를 쓴다

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

## 카피바라 테마 시트 (사과·울타리·게임 블록·사과 따기)

얼굴이 들어가는 게임 블록은 **줄마다 표정이 다른 3줄 시트**로 한 번에 만들고, 세로줄마다 윗줄(평소 얼굴) 상자로 잘라 표정을 바꿔 끼워도 겹치게 맞춘다. 자르기는 `python scripts/cut_emoji_sheets.py [시트이름 …]`.

| 시트 | 칸 | 들어가는 곳 |
|---|---|---|
| `cute-apples` | 가로 3 | `ui/lobby/fish-catches/{apple,green-apple,rotten-apple}.webp` — 카피바라 얼굴 사과(하트 웃음 / 별눈 반짝 / 눈물·애벌레 썩은 사과). 가방·나무에 달린 사과·먹는 사과 |
| `cute-apple-button` | 1장 | `ui/lobby/apple.webp` — 로비 "사과 따기" 버튼 (낚시 버튼과 같은 나무 테·펠트 판, 카피바라가 사과를 번쩍 듦) |
| `emoji-fence-vertical` | 세로 1장 | `props/fence-vertical` + `props/fence-post` (판 길이는 기둥 높이로 재서 한 타일만 남긴다) |
| `cute-fruit-{1,2,3}` | 가로 4·4·3 × 세로 3 | `games/watermelon-game/fruits/<slug>{,-surprise,-cry}.webp` 11종 — 평소 / 깜짝(땀방울, 빨리 떨어지거나 착지·선 위에서 위험할 때) / 우는 얼굴(합쳐질 때) |
| `cute-pang-{1,2}` | 가로 4·3 × 세로 3 | `games/capybara-pang/animals/<key>{,-happy,-cry}.webp` — 카피바라와 남미 습지 친구들 7종(카피바라·수달·청개구리·아기오리·마코앵무새·분홍 강돌고래·나무늘보). 평소 / 눈웃음+하트(깜빡임·고를 때) / 우는 얼굴(터질 때). 판에서 한눈에 갈리게 색이 겹치지 않는 동물로 고른다 |
| `emoji-pick` | 가로 3 × 세로 2 | `capybara-pick-{1,2,3}-{up,down}.webp` (사과 따기 폴짝) |
| `emoji-game-icons` | 가로 2 | `games/watermelon-game/icon.webp` (오른쪽 칸 옛 팡 아이콘은 안 씀) |
| `emoji-pang-icon` | 1장 | `games/capybara-pang/icon.webp` — 잎 접시 위 수달·카피바라·아기오리 구슬 |

- 귀여움 기준: 머리가 큰 치비 비율, 동글동글·통통, 흰 하이라이트 두 개가 든 큰 까만 눈, 작은 입, 진한 분홍 볼터치, 파스텔 톤 폭신한 펠트. 얼룩덜룩하거나 사실적인 질감은 다시 만든다
- 우는 얼굴은 **눈을 질끈 감은 >< + 좌우로 튀는 굵은 파란 펠트 눈물 + 크게 벌린 입**으로 통일한다. 게임 코드가 터지는 순간에만 이 그림으로 바꿔 그린다
- 과일·동물은 정사각형 canvas 가운데에 실루엣이 `PAD`(1.16) 여백으로 들어간다. 이 값은 `watermelon-game/constants.ts`의 `FRUIT_IMAGE_SCALE`과 짝이라 한쪽만 바꾸면 크기가 어긋난다
- 사과 따기 3프레임은 한 배율로 줄여 발바닥 높이를 맞춘다 (뜨는 높이는 로비의 폴짝 코드가 준다).
- 모델은 `-m gpt-5.6-luna` (빠르고 사용량이 적다). Codex가 파일 복사에 실패하면 `make_image`가 `~/.codex/generated_images`에서 방금 만든 그림을 찾아 가져온다. 단 동시에 돌린 생성이 있으면 어느 그림인지 모르니 멈추고 후보 경로를 보여 준다 — 그 세션 폴더의 마지막 그림을 확인해 `scripts/make_image/assets/<이름>.png`로 복사한다
