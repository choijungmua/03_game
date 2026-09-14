# SEO — 검색 노출 자동화 가이드

목표: 구글·네이버에서 게임 이름뿐 아니라 "반응속도 측정", "친구랑 오목" 같은 연관·롱테일 검색어로도 상단에 노출.
게임을 레지스트리에 등록하면 아래가 **자동으로** 붙고, 사람이 하는 일은 게임별 문구(`seo.ts`) 생성·검토뿐이다.

## 게임 하나에 자동으로 생기는 것

| 무엇 | 어디서 | 비고 |
|---|---|---|
| 제목·설명·키워드·canonical·OG 메타 | `app/games/[slug]/page.tsx` | `seo.ts`의 `metaTitle`·`metaDescription`·`keywords` |
| 게임 아래 소개(소개·하는 법·FAQ·다른 게임) | `app/games/_components/game-info.tsx` | 첫 화면은 게임 그대로 전체 화면, 스크롤하면 나온다 |
| 가이드 페이지 `/games/<slug>/guide` | `app/games/[slug]/guide/page.tsx` | `guide`·`tips`·`faq` 긴 본문 |
| 구조화 데이터(JSON-LD) | `lib/seo/json-ld.tsx` | 게임 `VideoGame`+`WebApplication`(무료), 가이드 `Article`, 모든 페이지 `BreadcrumbList` |
| 공유 카드 이미지 | `app/games/[slug]/opengraph-image.tsx` | 카피바라 아이콘 + 게임 이름 |
| sitemap·RSS·llms.txt | `app/sitemap.ts`, `app/rss.xml`, `app/llms.txt` | 레지스트리 전체를 돈다 |
| 허브 페이지 `/games` | `app/games/page.tsx` | 전체 게임 목록 + `ItemList` |

## 새 게임 추가 시 (CLAUDE.md "새 게임 추가 절차" 다음 단계)

1. `lib/games/registry.ts` 항목에 `seo: () => import("@/app/games/_games/<slug>/seo"),` 한 줄 추가
2. (선택) `pnpm seo:keywords <slug>` — 네이버 연관 검색어·검색수·추세를 `seo-keywords.json`으로 받는다
3. `pnpm seo:generate <slug>` — 게임 소스 코드와 트렌드를 Claude(`claude-opus-5`)에 넣어 `seo.ts` 작성
4. **검토**: 게임에 없는 기능·틀린 수치가 없는지 읽는다 (코드가 근거, 추측 금지)
5. `pnpm test lib/games/seo` — 길이·개수 규칙, 게임끼리 문구 중복 검사
6. 배포 후 `pnpm seo:indexnow` — 네이버·빙에 즉시 색인 요청

플레이 중에 페이지가 스크롤되면 안 되는 게임(드래그·휠·키 입력이 잦은 게임)은 `useLockPageScroll(phase === "playing")`을 부른다 (`lib/games/use-lock-page-scroll.ts`).

## 명령

| 명령 | 하는 일 |
|---|---|
| `pnpm seo:keywords <slug...>` / `--all` | 네이버 검색광고 키워드도구(연관 검색어·월간 검색수) + 데이터랩(최근 4주 ÷ 이전 12주 추세) → `seo-keywords.json` |
| `pnpm seo:generate <slug...>` | 지정 게임 `seo.ts` 새로 쓰기 |
| `pnpm seo:generate --missing` | `seo.ts`가 없는 게임만 |
| `pnpm seo:generate --stale` | 새 트렌드 상위 검색어 절반 이상이 지금 `keywords`에 없는 게임만 |
| `pnpm seo:indexnow` | 배포된 sitemap의 URL을 IndexNow(api.indexnow.org → 네이버·빙 등)로 전송 |

## 트렌드 자동화

`.github/workflows/seo-refresh.yml`이 매월 1일 `seo:keywords --all` → `seo:generate --stale --missing` → `pnpm test` → PR 생성까지 한다. PR을 검토하고 병합하면 반영된다.
저장소 Settings → Actions → General에서 "Allow GitHub Actions to create and approve pull requests"를 켜야 한다.

## 환경변수

로컬은 `.env.local`(커밋 안 됨), 배포는 호스팅 환경변수, 월간 워크플로는 GitHub Secrets에 넣는다.

| 이름 | 쓰는 곳 | 발급 |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | 전체 (없으면 `https://ggpli.com`) | — |
| `GOOGLE_SITE_VERIFICATION` | 레이아웃 메타 | 구글 서치 콘솔 → 속성 추가 → HTML 태그의 content 값 |
| `NAVER_SITE_VERIFICATION` | 레이아웃 메타 | 네이버 서치어드바이저 → 사이트 등록 → HTML 태그의 content 값 |
| `INDEXNOW_KEY` | `/indexnow.txt`, `seo:indexnow` | 8~128자 영문·숫자·`-` 아무 값 (배포와 로컬이 같아야 함) |
| `NAVER_SEARCHAD_API_KEY`·`NAVER_SEARCHAD_SECRET`·`NAVER_SEARCHAD_CUSTOMER_ID` | `seo:keywords` | 네이버 검색광고 → 도구 → API 사용 관리 |
| `NAVER_CLIENT_ID`·`NAVER_CLIENT_SECRET` | `seo:keywords` 추세 (없으면 건너뜀) | 네이버 개발자센터 → 애플리케이션 등록 → 데이터랩(검색어트렌드) |
| `ANTHROPIC_API_KEY` | `seo:generate` | Claude Console → API Keys |

## 최초 1회 (배포 후)

1. 구글 서치 콘솔: 속성 등록(메타 태그) → Sitemaps에 `https://ggpli.com/sitemap.xml` 제출
2. 네이버 서치어드바이저: 사이트 등록(메타 태그) → 요청 → 사이트맵 제출(`/sitemap.xml`), RSS 제출(`/rss.xml`)
3. `pnpm seo:indexnow`

## 원칙 (2026 기준)

- **대량 생성 스팸 주의**: 구글은 "가치 없이 생성형 AI로 대량 생성한 페이지"를 스팸으로 본다. 문구는 게임 코드의 실제 규칙·수치로만 쓰고, 게임마다 다르게 쓴다 (테스트가 중복을 막는다). 검토 없이 병합하지 않는다
- **리치결과**: FAQ 리치결과(2026-05 종료)·HowTo는 구글에서 더 안 나온다. FAQ는 JSON-LD 없이 화면 본문으로만 둔다 (네이버 AI 브리핑·사용자용). 게임은 `WebApplication`+무료 `offers`, 경로는 `BreadcrumbList`
- **llms.txt**: 구글 순위와 무관(구글 공식), 다른 AI 서비스가 읽으므로 유지만 한다
- **구글 트렌드 API**는 아직 신청제 알파라 쓰지 않는다. 한국어 검색어는 네이버 데이터가 더 쓸모 있다
- **IndexNow**는 네이버·빙만. 구글은 sitemap + 서치 콘솔
- 숨긴 텍스트(`sr-only`)는 순위에 거의 반영되지 않는다. 검색어는 보이는 본문에 쓴다
