# 온천 원본

`source.png`는 1639×960 투명 PNG 고해상도 원본입니다. 기존 구도와 펠트 질감을 유지하며 이미지 생성 도구로 선명도를 보완했습니다.

프로젝트 루트에서 배포용 WebP를 재생성합니다. Next.js가 사용하는 Sharp를 그대로 사용하며, 온천은 480 CSS px로 표시되므로 소품 기본값 384px 대신 1024px로 내보냅니다.

```powershell
node -e "const {createRequire}=require('node:module'); const sharp=createRequire(require.resolve('next/package.json'))('sharp'); sharp('assets-src/lobby/props/onsen/source.png').resize({width:1024}).webp({quality:92,alphaQuality:100,effort:6}).toFile('public/assets/images/lobby/props/onsen/image.webp').then(console.log)"
```

생성 지시: 기존 타원형 온천의 돌·유자 5개·꽃 배치, 위쪽 3/4 시점, 왼쪽 위의 부드러운 조명, 펠트 질감과 투명 배경을 유지하고 해상도와 가장자리 선명도만 개선. 바닥·그림자·김·글자·캐릭터는 추가하지 않음.
