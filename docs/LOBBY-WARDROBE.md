# PNG 카피바라 의상

원본 얼굴과 펠트 질감은 유지한다. 로비와 옷장 모두 `drawDressed`를 사용하며, 앉기/잠자기 크기 보정은 몸체와 모든 착용물에 함께 적용한다.

## 한벌옷 추가

1. `lib/lobby/garment-designs.ts`에 색상, 실루엣(`fitted`, `robe`, `coat`), 후드(`none`, `frog`, `dino`, `shark`)를 등록한다.
2. `lib/lobby/wardrobe.ts`의 한벌옷 목록에 같은 ID와 한국어 이름을 추가한다.
3. 고유 무늬가 필요하면 `character-clothes.ts`에 추가한다. 공통 밑단/소매/후드는 `garment-shapes.ts`에서 관리한다. 몸통 색 변경만으로 로브나 후드 의상을 대체하지 않는다.
4. `node scripts/preview-capybara.mjs onepiece/<id>`로 66개 자세를 확인하고, `node scripts/preview-capybara.mjs verify`로 전체 회귀 검사를 실행한다.
5. 안경·모자 조합과 실제 로비의 걷기, 앉기, 사과 수확, 목욕을 확인한다. 얼굴·손발을 덮거나 가장자리가 잘리는 조합은 배포하지 않는다.

## 월드 자산

집과 온천은 원본 캐릭터와 같은 부드러운 펠트 재질, 좌측 위 조명, 높은 3/4 시점의 투명 배경 이미지를 사용한다. 2D 캔버스로 일관되게 합성하며, 다른 카메라의 3D 캐릭터를 섞지 않는다. 온천 원본은 `assets-src/lobby/props/onsen/source.png`, 서빙 이미지는 1024×600 WebP이다. 같은 폴더의 README에 재생성 명령이 있다. 기존 바닥 앵커와 입수 영역을 유지한다.
