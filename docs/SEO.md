# ggpli SEO 체크리스트

도메인: `https://ggpli.com`

## 완료
- [x] `app/sitemap.ts` — 정적 페이지(`/`, `/list`, `/privacy`, `/terms`) + `lib/games/registry.ts`의 `GAMES` 자동 포함. 게임을 registry에 추가하면 sitemap에도 자동 반영
- [x] `app/robots.ts` — 전체 허용 + sitemap 위치 안내

## 배포 전 필수
- [ ] 빌드 실패 해결 — `app/games/_games/capybara-sneak/capybara-sneak.test.tsx`가 없는 모듈 `./capybara-sneak`을 import해서 `next build` 타입 체크 실패. 게임 완성 전이면 registry에서 빼기 (안 빼면 미완성 페이지가 sitemap에 노출됨)

## 배포 후 (한 번만)
- [ ] [Google Search Console](https://search.google.com/search-console)에 `ggpli.com` 등록 → `sitemap.xml` 제출
- [ ] [네이버 서치어드바이저](https://searchadvisor.naver.com)에 등록 → `sitemap.xml` 제출

## 메타데이터 (코드 작업)
1. [ ] **제목 템플릿** — `app/layout.tsx`에 `title: { template: "%s · ggpli", default: "ggpli" }`. 현재 게임 페이지 제목에 "ggpli"가 안 붙음. 적용 시 `app/list`, `app/privacy`, `app/terms`의 제목에 직접 붙인 `· ggpli`는 제거
2. [ ] **`metadataBase` + canonical** — `metadataBase: new URL("https://ggpli.com")`, 페이지별 `alternates.canonical`. `?ref=...` 같은 쿼리 주소를 하나의 페이지로 인식시킴
3. [ ] **Open Graph** — `layout.tsx`에 `openGraph` 추가 + `app/games/[slug]/opengraph-image.tsx`로 게임별 공유 이미지 자동 생성 (공유 기능이 있어 효과 큼)
4. [ ] **파비콘** — `app/icon.png` 추가 (현재 없음)
5. [ ] **홈 설명문** — `app/page.tsx`가 `"use client"`라 `metadata` export 불가 → layout의 `description`을 검색어가 들어간 문장으로 교체 (예: "반응속도 테스트, 클릭 속도 측정 등 무료 브라우저 게임")
6. [ ] **`theme-color` / `color-scheme`** — 다크 테마 기본이므로 `viewport` export로 설정 (AGENTS.md 규칙)

## 콘텐츠 (게임 제작하면서, 순위에 가장 큰 영향)
7. [ ] **게임 페이지 텍스트** — 게임은 클라이언트 컴포넌트뿐이라 검색엔진이 읽을 글이 없음. `registry.ts`에 `howTo`, `faq` 필드 추가 → `app/games/[slug]/page.tsx`에서 게임 아래 서버 렌더링 섹션으로 표시. 게임마다 고유한 문장으로 작성 (복붙 페이지 500개는 저품질 판정 위험)
8. [ ] **구조화 데이터(JSON-LD)** — 같은 `page.tsx`에 `WebApplication` + `FAQPage` 스키마. 7번과 함께 진행
9. [ ] **내부 링크** — 결과 화면 아래 "다른 게임" 링크 몇 개

## 운영 원칙
- 키워드는 실제 검색어 기준으로 `title`에 반영 (네이버 키워드도구, 구글 트렌드로 검색량 확인). 큰 키워드("반응속도 테스트")보다 롱테일("반응속도 테스트 평균")부터 노림
- 500개 일괄 공개보다 S티어부터 꾸준히 공개
- 광고가 게임 화면을 가리지 않게 유지 (AGENTS.md 광고 규칙)
- Core Web Vitals는 PageSpeed Insights로 주기적으로 측정
- 링크 구매 금지. 공유 기능·커뮤니티 확산으로 자연 유입
- 색인 수일~수주, 순위 안착 3~6개월 예상
- sitemap에 `changeFrequency`/`priority`는 구글이 무시하므로 넣지 않음. `lastModified`는 registry에 `updatedAt`이 생기면 추가 (`new Date()`는 매 빌드 전체 수정으로 보여 역효과)
