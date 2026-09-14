# ggpli 성능·확장성 최적화 계획

작성: 2026-09-14 · 대상: 로비(`app/_lobby`), 온라인 대전(`lib/games/rooms.ts`, `use-room.ts`), 기록형 게임 5종

## 요약

1. **서버 상태가 전부 프로세스 메모리(`globalThis` Map)에 있다.** Vercel(서버리스)에 배포돼 있어서, 인스턴스가 2개 이상 뜨는 순간 방 참가 404와 로비 유저 분리가 **사용자 수와 상관없이** 생긴다. 가장 먼저 고칠 문제
2. **로비는 150ms마다 HTTP POST를 보낸다.** 유저 1명이 초당 6.7요청을 만든다. 100명이면 초당 약 670요청, 500명이면 초당 약 3,300요청이고, 요청마다 전체 플레이어를 훑어서 O(n²)이다. 서버리스 폴링 방식으로는 비용이 감당되지 않는다
3. **리렌더 병목은 4곳이다.** 매 프레임 setState(알까기 샷), 1ms/10ms 타이머(반응속도, 클릭 스피드), 1초 폴링마다 새 객체로 판 전체를 다시 그림(바둑·오목·알까기). React Compiler로 대부분 줄이고, 나머지는 로비처럼 ref로 DOM에 직접 쓴다

---

## 0. 현재 진단

### 서버·네트워크

| # | 위치 | 문제 | 영향 |
|---|------|------|------|
| S1 | `lib/games/rooms.ts:87-93`, `lib/lobby/presence.ts:59-64` | 방·플레이어를 `globalThis` Map에 저장 | 서버리스 다중 인스턴스에서 방 생성·참가가 서로 다른 인스턴스로 가면 "없는 초대 코드", 로비 유저끼리 서로 안 보임. 콜드 스타트 때 전부 초기화 |
| S2 | `app/_lobby/lobby.tsx:115,1100` | `SYNC_MS = 150` HTTP 폴링. 가만히 서 있거나 탭이 숨겨져도 계속 보냄 | 유저당 초당 6.7 함수 호출 |
| S3 | `lib/lobby/presence.ts:109-111,161-164` | 요청마다 전체 순회(stale 정리 + 거리 필터) | 요청당 O(n) → 전체 O(n²). 500명이면 초당 약 160만 연산 |
| S4 | `lib/lobby/presence.ts:161-163` | 거리 필터 후 정렬 없이 `slice(0, 60)` | 사람이 많으면 가장 **가까운** 60명이 아니라 먼저 들어온 60명이 보인다 (버그) |
| S5 | `lib/lobby/presence.ts:115`, `rooms.ts:132` | 요청 속도 제한 없음 | 토큰만 바꿔 500번 보내면 로비가 꽉 차서 모두 503. 방 만들기를 반복하면 메모리가 계속 늘어난다 |
| S6 | `lib/games/use-room.ts:128` | 대국자·관전자 모두 1초 폴링. 숨은 탭에서도 계속 돌고, 판이 안 바뀌어도 전체 상태를 내려받음 | 동시 대국 1,000판이면 초당 2,000요청 이상 |

페이지 자체는 문제없다. `/`과 `/games/[slug]`는 정적 생성(`generateStaticParams`)이라 CDN이 처리한다. **확장 문제는 API 3개(`/api/lobby`, `/api/games/[slug]/rooms/**`)에만 있다.**

### 클라이언트 리렌더

| # | 위치 | 원인 | 빈도 | 다시 그리는 범위 |
|---|------|------|------|------------------|
| R1 | `capybara-alkkagi.tsx:175` | 샷 애니메이션 중 매 rAF마다 `setFrame` | 60회/초 (샷당 수 초) | 화면 전체: 배경 Image 2장, 판, 알 버튼 전부, Dialog |
| R2 | `capybara-alkkagi.tsx:220` | 드래그 중 pointermove마다 `setAim` | 60~120회/초 | 화면 전체 |
| R3 | `reaction-time.tsx:34` | `setInterval(…, 1)` | 브라우저 최소 간격(약 4ms) 기준 약 250회/초 | `RunningTimer` (분리돼 있어 범위는 작음) |
| R4 | `click-speed.tsx:51` | `setInterval(…, 10)` | 100회/초 | `PlayTimer` |
| R5 | `click-speed.tsx:134-135,172` | 탭마다 `setRipples` + `setCount`, 애니메이션이 끝날 때 또 `setRipples` | 탭당 2회 (15탭/초면 30회/초) | `ClickSpeed` 루트 전체 |
| R6 | `use-room.ts:53-54` | 버전이 같아도 폴링 응답마다 새 `view` 객체로 교체, `clockOffset`도 매번 몇 ms씩 바뀜 | 1초마다 1~2회 | `CapybaraRoom` 전체. 오목은 225칸 버튼 + 돌 Image |
| R7 | `capybara-sneak.tsx:111-112` | 누르는 동안 80ms마다 `setGauge`·`setTrend` | 12.5회/초 | 장면 전체 (Image 9장) |
| R8 | `capybara-plane-shooter.tsx:336-341` | 점수가 바뀔 때마다 루트에서 `setHud`. 매 프레임 `readHud` 객체 생성과 `join` | 적 격추 때마다 + 프레임당 GC | 루트 (플레이 중이라 트리는 작음) |

**손대지 않아도 되는 곳:** 로비(`lobby.tsx`)는 rAF + ref 구조이고 setState는 값이 바뀔 때만 한다(`shownDoor` 등). `useState`가 같은 값이면 알아서 건너뛰므로 `setOnline`도 문제없다. `local-records.ts`는 `useSyncExternalStore` + 문자열 스냅샷이라 이미 최적이다.

---

## 1. 단계별 계획

### Phase 0: 코드 몇 줄로 줄이는 것 (반나절)

인프라를 건드리지 않고 요청 수와 리렌더를 먼저 줄인다.

- [ ] **로비: 안 움직이면 덜 보낸다** (`lobby.tsx` `sync`). 위치·방향·앉기가 마지막으로 보낸 값과 같고 때리기도 없으면 2초에 한 번만 보낸다(heartbeat, `STALE_MS` 10초보다 짧게). 로비 유저 대부분이 서 있거나 오두막 앞에 있으니 요청이 크게 준다
- [ ] **로비·방: 숨은 탭에서는 멈춘다.** `document.hidden`이면 `sync`/`poll`을 건너뛰고, `visibilitychange`로 돌아오면 바로 한 번 보낸다(방 폴링에는 이미 복귀 처리가 있음)
- [ ] **presence: 가까운 순으로 자른다 (S4).** `filter` 뒤에 거리로 정렬하고 `slice`. 정렬은 60명보다 많을 때만
- [ ] **use-room: 같은 버전이면 기존 객체를 유지한다 (R6).** `next.version < current.version`을 `<=`로 바꾼다. `joined`·`emote`·시간 초과가 모두 `version`을 올리므로 안전하다. `clockOffset`은 차이가 250ms(TurnTimer 주기)를 넘을 때만 갱신한다
- [ ] **타이머를 rAF + ref로 (R3, R4).** `RunningTimer`와 `PlayTimer`가 `requestAnimationFrame`에서 `ref.current.textContent`를 직접 쓰게 한다. 로비의 `renderStick`과 같은 방식이고 React 렌더는 0회가 된다. 기록값은 `finishRound`의 `Date.now()`에서 오므로 판정에 영향이 없다

검증: 기존 vitest 통과 + React DevTools "Highlight updates"로 해당 화면에서 깜빡임이 없는지 확인.

### Phase 1: 리렌더 구조 정리 (1~2일)

- [ ] **React Compiler 켜기.** `pnpm add -D babel-plugin-react-compiler` 후 `next.config.ts`에 `reactCompiler: true`를 넣는다(Next 16 안정 옵션, `node_modules/next/dist/docs/.../reactCompiler.md`). 부모가 다시 그려져도 props가 같은 자식(Image, 판 칸, Dialog, 순위표)은 자동으로 건너뛴다. R7(카피바라 몰래 먹기)과 R8(비행기 슈팅)은 이것만으로 충분할 가능성이 크다. 켠 뒤 `pnpm lint`와 `pnpm test`, 빌드 시간을 비교한다. 문제가 생긴 컴포넌트만 `"use no memo"`로 뺀다
- [ ] **알까기 샷 애니메이션을 DOM 직접 쓰기로 (R1).** 알 버튼 ref를 `Map<pieceId, HTMLButtonElement>`로 들고, rAF에서 `style.transform`만 바꾼다. `setFrame`은 없애고 끝날 때 서버 상태로 한 번만 렌더. 떨어짐(`out`) 표시가 프레임 중간에 필요하면 그 알만 `data-out`을 직접 토글한다
- [ ] **알까기 조준을 좁은 컴포넌트로 (R2).** 조준선 SVG와 힘 막대만 `aim`을 구독하게 분리한다. 알 목록에는 `aimedPieceId`(숫자)와 `aiming`(불리언)만 넘겨서, 드래그 중 각도·힘이 바뀌어도 알 목록은 다시 그려지지 않게 한다
- [ ] **클릭 스피드 물결 (R5).** 물결을 state 배열 대신 컨테이너에 `span`을 붙이고 `animationend`에서 떼는 방식으로 바꾼다. 루트는 `count`가 바뀔 때만 렌더
- [ ] **비행기 슈팅 HUD (R8, Compiler로 부족할 때만).** `readHud` 결과를 필드별로 직접 비교해 문자열 조합을 없애고, HUD를 자식 컴포넌트로 분리

검증: [React Scan](https://github.com/aidenybai/react-scan) 또는 DevTools Profiler로 아래 시나리오마다 초당 렌더 수를 전·후 기록한다.

| 시나리오 | 지금(예상) | 목표 |
|----------|-----------|------|
| 반응속도 running 3초 | 약 250/초 | 0 |
| 클릭 스피드 15탭/초 | 약 130/초 | ≤15 |
| 알까기 샷 1회 | 60/초 × 화면 전체 | 시작·끝 2회 |
| 오목 대기 중(상대 차례) | 1~2/초 × 225칸 | 상대가 둘 때만 |

### Phase 2: 온라인 대전을 공유 저장소로 (2~3일), S1·S6 해결

턴제라 초당 쓰기가 적다. **HTTP는 그대로 두고 저장소만 바꾸는 게 가장 작은 변경이다.**

- [ ] `RoomStore` 인터페이스(`createRoom`/`readRoom`/`actOnRoom`)는 유지하고, 구현만 Redis(Vercel Marketplace의 Upstash, REST라 서버리스와 맞음)로 교체한다
  - 방 하나 = 키 하나(`room:{slug}:{code}`), 값은 JSON, `EX 86400`으로 TTL. 지금의 `createRoom` 안 정리 루프는 필요 없어진다
  - 동시에 두 수가 들어오는 경합은 `version` 비교 후 쓰기(Lua 스크립트 또는 `WATCH`/`MULTI`)로 막는다. 이미 `version` 필드가 있어서 그대로 쓰면 된다
  - 인터페이스가 async가 되므로 라우트 3개와 `rooms.test.ts`를 `await`로 바꾼다. 테스트는 Map 기반 가짜 구현을 그대로 둔다
- [ ] 폴링 응답을 줄인다: `GET …/rooms/{code}?token=…&v={version}`에서 버전이 같으면 `204`(본문 없음)를 돌려준다. 클라이언트는 204면 아무것도 안 한다(R6과 함께)
- [ ] 방 만들기와 presence에 IP당 속도 제한(S5). Vercel Firewall 규칙으로 코드 없이 거는 것이 먼저이고, 부족하면 Redis `INCR` + `EXPIRE`로 건다

SSE/WebSocket 전환은 **이 단계에서 하지 않는다.** 1초 폴링 + 204면 대국 1판당 부담이 작다. 동시 대국이 수천 판을 넘어 함수 호출 비용이 실제로 문제가 될 때 다시 본다.

### Phase 3: 로비 실시간 서버 분리 (3~5일), S1·S2·S3 해결

150ms 위치 동기화는 서버리스 HTTP에 맞지 않는다. Redis로 옮겨도 요청 수는 그대로다. **상태를 한 곳에 들고 있는 WebSocket 서버가 필요하다.**

- [ ] **권장: Cloudflare Durable Objects(또는 그 위의 PartyKit).** 방(채널) 하나 = 객체 하나이고 단일 인스턴스라서, 지금의 `presence.ts` 인메모리 로직(순간이동 검사, 때리기 판정)을 **거의 그대로 옮길 수 있다.** 서버 권한 판정도 유지된다
  - 대안인 Supabase Realtime(Broadcast/Presence)은 클라이언트끼리 직접 중계라서 때리기·순간이동 판정을 서버에서 할 곳이 따로 필요하다. 그래서 이 프로젝트에는 비권장
- [ ] **채널 분할:** 채널당 최대 50~100명(`lobby-1`, `lobby-2`…). 들어올 때 덜 찬 채널에 배정하고 화면에 "N채널"을 표시한다. 채널을 나누면 O(n²)도 채널 크기 안으로 묶인다
- [ ] **서버 틱 방식:** 클라이언트는 입력이 바뀔 때만 보내고, 서버는 100~150ms마다 근처 플레이어 스냅샷을 브로드캐스트한다. 거리 계산은 셀 크기 `VIEW_RADIUS`의 공간 격자(`Map<"cx,cy", Set<Player>>`)로 주변 9칸만 본다
- [ ] 클라이언트 변경은 `lobby.tsx`의 `sync()` 한 함수로 끝나야 한다. `fetch`를 `WebSocket.send`/`onmessage`로 바꾸고 응답 처리부(remotes 갱신)는 재사용한다. 연결이 끊기면 지금처럼 "혼자 모드"
- [ ] `/api/lobby` 라우트와 `presence.ts`의 `globalThis` 부분 삭제(로직은 DO로 이동, 테스트 `presence.test.ts`는 순수 함수 부분 유지)

### Phase 4: 게임 500개 대비 (게임 50개를 넘을 때)

- [ ] `lib/lobby/world.ts:172-186` `buildingAt`/`deckSpur`가 타일마다 `buildings.some`/`doors.some`로 O(게임 수)다. 청크(256타일)를 굽는 비용이 게임 수에 비례해 커지므로 `Map<"tx,ty", …>` 인덱스로 바꾼다. 날개 길이 문제는 기존 `ponytail:` 주석대로 카테고리 오두막으로 해결
- [ ] 로비의 `icons` Map이 모든 게임 아이콘을 한꺼번에 `loadImage`한다(`lobby.tsx:520`). 화면 근처 오두막 아이콘만 필요할 때 로드
- [ ] `registry.ts`는 `dynamic()` import라 게임 코드가 번들에 섞이지 않는다. 지금 구조를 유지한다

---

## 2. 측정 방법

- **리렌더:** React DevTools Profiler 녹화 + "Highlight updates when components render". Phase 1 표의 시나리오별로 전·후 수치를 PR에 남긴다
- **부하:** `autocannon`(설치 없이 `pnpx autocannon`)으로 로컬 `next start`에서 `/api/lobby`를 토큰 N개로 호출해 p95 응답시간을 잰다. Phase 3 이후에는 WebSocket 클라이언트 N개 스크립트로 채널당 100명 기준 틱 지연을 잰다
- **운영:** Vercel Observability에서 함수 호출 수와 실행 시간(Phase 0 전·후 비교), 404 비율(`rooms/[code]`, S1 발생 여부)

## 3. 하지 않을 것

- 수동 `useMemo`/`useCallback`/`React.memo` 도배: React Compiler가 대신한다
- 전역 상태 라이브러리 도입: 게임끼리 상태를 공유하지 않는다(CLAUDE.md 원칙)
- 기록 저장을 서버로 옮기기: 순위표는 로컬 기록이라 서버 부하가 없다. 전체 순위 기능이 기획될 때 따로 논의
- 게임 캔버스를 WebGL로 교체: 병목이 아니다

## 4. 결정이 필요한 것

1. **Phase 2 저장소:** Upstash Redis(권장) vs Supabase Postgres. Redis는 TTL과 원자적 쓰기가 기본 기능이라 코드가 적다
2. **Phase 3 실시간 호스트:** Cloudflare Durable Objects/PartyKit(권장) vs 별도 Node 서버(Fly.io 등, 인스턴스 1대 운영 부담). Vercel 밖에 서비스가 하나 생긴다
3. **채널당 인원:** 50 vs 100. 로비가 붐벼 보이는 느낌과 서버 부하 사이의 선택
