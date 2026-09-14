# 게임 일시정지·뒤로가기 UI 설계

작성: 2026-09-14 · 상태: 사용자 승인(1부) · 대상: `app/games/_games/*` 8개 게임

## 배경

- 지금 8개 게임 모두 로비로 가는 버튼·일시정지가 없다. 나가려면 브라우저 뒤로가기뿐
- 로비(`/`)는 들어간 오두막 문 앞 위치를 sessionStorage(`lobby-position-v3`)에 저장하므로 `<Link href="/">`로 돌아가도 그 자리에서 다시 시작된다
- 게임 대부분이 루트 컨테이너 전체에 `onPointerDown`/`onClick`을 건다. 오버레이 버튼·Dialog는 React 트리로 이벤트가 버블링되므로(포털이어도) `stopPropagation`이 필요하다 (`ShareButton` 패턴)

## 결정

게임 성격에 맞게 다르게 동작한다. 버튼이 약속하는 동작과 실제 동작이 같아야 하고, 기록이 걸린 짧은 게임에서 멈춤을 허용하면 순위 공정성이 깨지기 때문.

| 게임 | 뒤로 버튼(왼쪽 위) | 일시정지 버튼(오른쪽 위) | 동작 |
|---|---|---|---|
| capybara-plane-shooter, capybara-log-dodge | 항상 | 플레이 중에만 | 멈춤 창. 이어하기 = 멈춘 순간부터 그대로 |
| capybara-sneak | 항상 | 플레이 중에만 | 멈춤 창. 이어하기 = 주인 등 돌리기 주기는 처음부터 |
| reaction-time, click-speed | 항상 | 없음 | 카운트다운·플레이 중 누르면 이번 판 취소 → 시작 화면(기록 저장·전송 안 함). 그 외 화면에서는 로비로 |
| capybara-baduk, capybara-gomoku, capybara-alkkagi | 항상 | 없음 | 대국 중이면 확인 창("나가면 상대가 기다리게 돼요") 후 로비로. 대기·결과 화면은 바로 로비로 |

공통:
- 일시정지 버튼이 있는 게임은 플레이 중 탭이 숨겨지면(`visibilitychange` → hidden) 자동으로 멈추고, `Esc`로 멈춤/이어하기를 토글한다
- 멈춤 창: 제목 "일시정지", 버튼 "이어하기" / "처음부터" / "로비로"(Link). 창 밖 클릭·Esc = 이어하기
- 공유 버튼은 시작·결과 화면 오른쪽 위에만 있으므로 플레이 중 일시정지 버튼과 겹치지 않는다
- 광고는 컨트롤·멈춤 창에 넣지 않는다 (AGENTS.md 광고 규칙)

범위 밖:
- 온라인 대전 나가기 시 서버에 알려 자리 비우기 (`use-room.ts`의 `leave`는 클라이언트 전용 — 별도 작업)
- 반응속도·클릭 스피드의 진짜 일시정지
- 방식 2(page.tsx 단일 뒤로 버튼), 방식 3(공용 usePause 훅)은 채택하지 않음: 게임 상태를 몰라 취소·확인을 못 하거나, 게임마다 멈추는 방식이 달라 공통화가 오히려 복잡

## 구조

### 공용 컴포넌트 `components/games/game-controls/`

`share-button`과 같은 폴더 구성: `game-controls.tsx`, `type.ts`, `index.tsx`, `game-controls.test.tsx`. 게임 하나짜리가 아니라 8개가 쓰지만 compound까지는 필요 없다(버튼 2개 + 창 1개).

```ts
// type.ts
export interface GameControlsProps {
  /** 넘기면 오른쪽 위에 일시정지 버튼 + 멈춤 창. 플레이 중에만 넘긴다 */
  pause?: {
    paused: boolean;
    onPause: () => void;
    onResume: () => void;
    onRestart: () => void;
  };
  /** 넘기면 뒤로 버튼이 로비 이동 대신 이 함수를 부른다 (반응속도·클릭 스피드의 판 취소) */
  onCancelRound?: () => void;
  /** 넘기면 뒤로 버튼이 이 문구로 확인 창을 띄운 뒤 로비로 (온라인 대전 중) */
  leaveConfirm?: string;
  className?: string;
}
```

동작:
- 뒤로 버튼
  - 기본: `<Link href="/" aria-label="로비로 돌아가기">` (lucide `ArrowLeft`)
  - `onCancelRound`: `<button aria-label="이번 판 그만하기">` → `onCancelRound()`
  - `leaveConfirm`: `<button aria-label="로비로 돌아가기">` → 확인 `Dialog`(문구 + "계속 두기" 닫기 + "나가기" Link)
  - 우선순위: `onCancelRound` > `leaveConfirm` > 기본 (둘을 같이 넘기는 게임은 없음)
- 일시정지 버튼(`pause` 있을 때): `<button aria-label="일시정지">` (lucide `Pause`) → `onPause()`
- 멈춤 창: 기존 `components/overlay/dialog`, `open={pause.paused}`, 닫힘(창 밖·Esc) = `onResume`
- `pause` 있을 때 document `visibilitychange`(hidden)와 `keydown` Esc 구독. 멈춘 상태의 Esc는 Dialog가 처리
- 모든 버튼·창 내용에서 `pointerdown`/`click` 전파 차단
- 스타일: `ShareButton`과 같은 둥근 `size-11 bg-current/10` 버튼, 위치 `absolute left-4 / right-4 top-[max(1rem,env(safe-area-inset-top))]`. 색은 `currentColor` 기반이라 게임 배경색을 따라감. 포커스 링 `focus-visible:outline-current`

### 게임별 변경

**capybara-plane-shooter / capybara-log-dodge (rAF)**
- `const [paused, setPaused] = useState(false)` + `pausedRef`(루프에서 읽음)
- 루프 프레임 시작에서 `if (pausedRef.current) { lastAt = now; schedule next; return; }` — step을 건너뛰고 기준 시각만 갱신 → 이어할 때 시간 점프 없음. `phase`는 바꾸지 않는다(playing effect가 `[phase]`로 상태를 새로 만들기 때문)
- 멈춘 동안 포인터·키 입력 무시, 포인터 캡처 해제
- log-dodge의 피격 `setTimeout(HIT_PAUSE_MS)`은 멈춤과 겹쳐도 짧아서 그대로 둔다
- `onRestart` = 멈춤 해제 + 카운트다운부터 다시(`phase: "countdown"`)
- 플레이가 끝나면(`result`) `paused` false로 리셋
- 루트에 `data-paused` 속성

**capybara-sneak (타이머)**
- `paused` state. 기존 effect 게이트 `status !== "playing"`에 `|| paused` 추가 → 모든 타이머가 정리되고, 이어하면 주인 주기가 처음(`away`)부터 다시 시작
- 멈출 때 누르고 있던 입력 해제(기존 blur 처리 재사용)
- `onRestart` = `ready`로 리셋(기존 "다시 하기"와 같은 경로)

**reaction-time / click-speed (판 취소)**
- 카운트다운·진행 중(reaction: `countdown`/`too-soon`/`running`, click: `countdown`/`playing`)에만 `onCancelRound` = `setPhase("idle")`. 기존 effect cleanup이 타이머를 정리. 기록 저장·`submitGameRecord` 호출 없음
- click-speed는 탭 수·리플 등 진행 상태도 초기화

**capybara-room(바둑·오목) / capybara-alkkagi**
- 대국 중(상대 입장 완료 && 종료 전)에만 `leaveConfirm="나가면 상대가 기다리게 돼요"`
- 루트에 클릭 핸들러가 없으므로 전파 문제는 없지만 컴포넌트 내부 차단은 동일하게 적용

## 테스트

기존 패턴(Vitest + Testing Library, `vi.useFakeTimers`, `data-phase` 검사) 사용.

- `game-controls.test.tsx`
  - 기본 뒤로 버튼이 `href="/"` 링크
  - `onCancelRound` 있으면 버튼이 링크가 아니고 누르면 호출
  - `leaveConfirm` 있으면 확인 창 → "나가기"가 `/` 링크
  - 일시정지 버튼 → `onPause`, `paused`면 창 표시, "이어하기"/"처음부터" 호출
  - hidden `visibilitychange`와 `Esc` → `onPause`
  - 버튼·창 조작이 부모 `onPointerDown`/`onClick`으로 전파되지 않음
- reaction-time / click-speed: 카운트다운 중 뒤로 → `data-phase="idle"`, 기록 저장 안 됨(localStorage 비어 있음)
- capybara-sneak: 플레이 중 멈춤 → 타이머를 한참 진행해도 상태 변화 없음 → 이어하기 후 다시 진행
- capybara-log-dodge: 플레이 중 일시정지 → `data-paused="true"`, 이어하기 → false (rAF는 기존처럼 구동하지 않음)
- capybara-room: 대국 중 뒤로 → 확인 창 표시
- 마지막에 `pnpm tsc --noEmit`, 관련 테스트 전체 실행
