# 게임 일시정지·뒤로가기 UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 8개 게임에 로비로 가는 뒤로 버튼을 달고, 실시간 게임 3개(비행기 슈팅·통나무 피하기·몰래 먹기)에는 일시정지를, 기록 측정 게임 2개(반응속도·클릭 스피드)에는 판 취소를, 온라인 대전 3개에는 나가기 확인을 넣는다.

**Architecture:** 공용 `components/games/game-controls`(뒤로 버튼 + 일시정지 버튼 + 멈춤 창 + 나가기 확인 창)가 버튼 모양·전파 차단·Esc/탭 숨김 감지를 맡고, 멈추는 방법은 각 게임이 자기 상태(`paused`)로 처리한다. 스펙: `docs/superpowers/specs/2026-09-14-game-pause-back-design.md`.

**Tech Stack:** Next.js 16 (`next/link`), React 19 (`useEffectEvent`), Radix Dialog(`components/overlay/dialog`), lucide-react, Tailwind v4, Vitest + Testing Library(jsdom).

---

## 공통 규칙 (모든 Task)

- 명령은 워크트리 루트 `C:\Users\user\Desktop\project\03_game\.claude\worktrees\game-visit-count`에서 PowerShell로 실행
- 테스트 필터는 파일 이름 조각으로 준다 (`[slug]` 같은 경로 문자열은 필터로 안 먹힘): `pnpm vitest run game-controls`
- `any`/`unknown` 금지. 클래스 병합은 `cn()`(`@/lib`). 색 하드코딩 금지(`bg-current/10`은 `ShareButton`과 같은 방식이라 허용)
- 커밋 메시지 끝에 항상 두 줄:
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01KBXVYMCphfEypouhwP6Fnb
  ```
- 줄 번호는 이 계획 작성 시점 기준. 앞 Task에서 import가 한 줄 늘면 뒤 줄 번호가 밀리므로 **코드 조각(anchor)으로 찾는다**

## File Structure

| 파일 | 역할 |
|---|---|
| Create `components/games/game-controls/type.ts` | `GameControlsProps` |
| Create `components/games/game-controls/constants.ts` | 둥근 버튼 클래스, 나가기 확인 문구 (상수는 로직 파일이 아니라 모듈 옆 `constants.ts`에 둔다) |
| Create `components/games/game-controls/game-controls.tsx` | 뒤로 버튼(Link/판 취소/나가기 확인), 일시정지 버튼, 멈춤 창, 전파 차단, Esc·visibilitychange |
| Create `components/games/game-controls/index.tsx` | re-export (`share-button`과 같은 구성) |
| Create `components/games/game-controls/game-controls.test.tsx` | 공용 동작 테스트 |
| Modify `app/games/_games/reaction-time/reaction-time.tsx` (+test) | 판 취소 |
| Modify `app/games/_games/click-speed/click-speed.tsx` (+test) | 판 취소 |
| Modify `app/games/_games/capybara-sneak/capybara-sneak.tsx` (+test) | 일시정지(타이머 게이트), 게이지 폭 |
| Modify `app/games/_games/capybara-log-dodge/capybara-log-dodge.tsx` (+test) | 일시정지(rAF), HUD 여백 |
| Modify `app/games/_games/capybara-plane-shooter/capybara-plane-shooter.tsx` / Create `capybara-plane-shooter.test.tsx` | 일시정지(rAF), HUD 여백 |
| Modify `components/games/capybara-room/capybara-room.tsx` (+test) | 나가기 확인, 상단 카드 여백 |
| Modify `app/games/_games/capybara-alkkagi/capybara-alkkagi.tsx` | 나가기 확인, 상단 카드 여백 |

## 스펙에서 정하지 않아 여기서 정한 것

- 멈춤 창·확인 창의 "로비로"/"나가기"는 `buttonVariants`(`@/components/inputs/button`)로 꾸민 `<Link>`. `Button asChild`는 쓰지 않는다 — `Button`이 children을 `<span>`으로 감싸서 Slot이 Link가 아니라 span에 props를 붙인다
- 포인터 캡처는 따로 `releasePointerCapture`하지 않는다. 멈출 때 `dragRef.current = null`이면 `handlePointerMove`가 무시하고, 캡처는 손을 떼면 풀린다
- 온라인 대전 확인 창은 **내가 대국자(`view.you`)이고** 상대 입장 완료 && 종료 전일 때만. 관전자는 나가도 기다리는 사람이 없어 바로 로비 링크
- 확인 창 제목 "로비로 나갈까요?", 버튼 "계속 두기"(닫기) / "나가기"(Link). 멈춤 창 제목 "일시정지", 설명 "게임을 잠깐 멈췄어요."
- 컨트롤 버튼은 `z-20`(대전 게임 상단 카드가 `z-10`)
- 버튼 클래스(`ROUND_BUTTON`)와 대전 게임 두 곳에서 쓰는 확인 문구(`LEAVE_CONFIRM_MESSAGE`)는 `components/games/game-controls/constants.ts`에 두고 index에서 re-export (프로젝트 규칙: 상수는 constants.ts)
- 알까기는 컴포넌트 테스트 파일이 없어 새로 만들지 않는다. 같은 prop 한 줄이라 `capybara-room` 테스트 + `tsc`로 갈음
- 비행기 슈팅은 컴포넌트 테스트가 없어서, 통나무 피하기와 같은 일시정지 테스트만 새 파일로 추가

---

### Task 1: GameControls 공용 컴포넌트

**Files:**
- Create: `components/games/game-controls/type.ts`
- Create: `components/games/game-controls/constants.ts`
- Create: `components/games/game-controls/game-controls.tsx`
- Create: `components/games/game-controls/index.tsx`
- Test: `components/games/game-controls/game-controls.test.tsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`components/games/game-controls/game-controls.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GameControls } from "./game-controls";

function pauseProps(paused: boolean) {
  return { paused, onPause: vi.fn(), onResume: vi.fn(), onRestart: vi.fn() };
}

function setVisibility(value: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", { value, configurable: true });
}

describe("GameControls", () => {
  afterEach(() => {
    setVisibility("visible");
  });

  it("기본 뒤로 버튼은 로비(/)로 가는 링크다", () => {
    render(<GameControls />);
    expect(screen.getByRole("link", { name: "로비로 돌아가기" })).toHaveAttribute("href", "/");
    expect(screen.queryByRole("button", { name: "일시정지" })).toBeNull();
  });

  it("onCancelRound가 있으면 뒤로 버튼이 링크가 아니라 판 취소 버튼이다", () => {
    const onCancelRound = vi.fn();
    render(<GameControls onCancelRound={onCancelRound} />);
    expect(screen.queryByRole("link", { name: "로비로 돌아가기" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "이번 판 그만하기" }));
    expect(onCancelRound).toHaveBeenCalledTimes(1);
  });

  it("leaveConfirm이 있으면 확인 창을 띄우고, 나가기는 로비 링크다", () => {
    render(<GameControls leaveConfirm="나가면 상대가 기다리게 돼요" />);
    fireEvent.click(screen.getByRole("button", { name: "로비로 돌아가기" }));
    expect(screen.getByText("나가면 상대가 기다리게 돼요")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "나가기" })).toHaveAttribute("href", "/");

    fireEvent.click(screen.getByRole("button", { name: "계속 두기" }));
    expect(screen.queryByText("나가면 상대가 기다리게 돼요")).toBeNull();
  });

  it("일시정지 버튼을 누르면 onPause를 부른다", () => {
    const pause = pauseProps(false);
    render(<GameControls pause={pause} />);
    fireEvent.click(screen.getByRole("button", { name: "일시정지" }));
    expect(pause.onPause).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("멈춘 상태면 멈춤 창을 띄우고 이어하기·처음부터·Esc·로비로를 제공한다", () => {
    const pause = pauseProps(true);
    render(<GameControls pause={pause} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("일시정지");

    fireEvent.click(screen.getByRole("button", { name: "이어하기" }));
    expect(pause.onResume).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "처음부터" }));
    expect(pause.onRestart).toHaveBeenCalledTimes(1);

    expect(screen.getByRole("link", { name: "로비로" })).toHaveAttribute("href", "/");

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(pause.onResume).toHaveBeenCalledTimes(2);
    expect(pause.onPause).not.toHaveBeenCalled();
  });

  it("플레이 중 Esc를 누르거나 탭이 숨겨지면 멈춘다", () => {
    const pause = pauseProps(false);
    render(<GameControls pause={pause} />);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(pause.onPause).toHaveBeenCalledTimes(1);

    setVisibility("hidden");
    fireEvent(document, new Event("visibilitychange"));
    expect(pause.onPause).toHaveBeenCalledTimes(2);
  });

  it("버튼과 멈춤 창 조작이 뒤의 게임 화면으로 전달되지 않는다", () => {
    const onPointerDown = vi.fn();
    const onClick = vi.fn();
    const { rerender } = render(
      <div onPointerDown={onPointerDown} onClick={onClick}>
        <GameControls onCancelRound={vi.fn()} pause={pauseProps(false)} />
      </div>,
    );

    for (const name of ["이번 판 그만하기", "일시정지"]) {
      const button = screen.getByRole("button", { name });
      fireEvent.pointerDown(button);
      fireEvent.click(button);
    }

    rerender(
      <div onPointerDown={onPointerDown} onClick={onClick}>
        <GameControls onCancelRound={vi.fn()} pause={pauseProps(true)} />
      </div>,
    );
    const resume = screen.getByRole("button", { name: "이어하기" });
    fireEvent.pointerDown(resume);
    fireEvent.click(resume);

    expect(onPointerDown).not.toHaveBeenCalled();
    expect(onClick).not.toHaveBeenCalled();
  });
});
```

창 밖(오버레이) 탭으로 닫기는 단위 테스트하지 않는다(스펙 참고 — jsdom에서는 래퍼의 `stopPropagation`이 Radix의 document 리스너보다 먼저 막음). Task 9 수동 확인.

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `pnpm vitest run game-controls`
Expected: FAIL — `Failed to resolve import "./game-controls"`

- [ ] **Step 3: 타입 작성**

`components/games/game-controls/type.ts`:

```ts
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
  /** 넘기면 뒤로 버튼이 이 문구로 확인 창을 띄운 뒤 로비로 (온라인 대국 중) */
  leaveConfirm?: string;
  /** 래퍼(display: contents)에 붙는 클래스. 플레이 화면의 `dark` 스코프를 따를 때 쓴다 */
  className?: string;
}
```

`components/games/game-controls/constants.ts`:

```ts
/** ShareButton과 같은 둥근 버튼. 색은 currentColor라 게임 배경색을 따라간다 */
export const ROUND_BUTTON =
  "absolute top-[max(1rem,env(safe-area-inset-top))] z-20 inline-flex size-11 cursor-pointer items-center justify-center rounded-full bg-current/10 transition-colors hover:bg-current/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current";

/** 온라인 대국 중 뒤로 버튼 확인 문구 (바둑·오목·알까기) */
export const LEAVE_CONFIRM_MESSAGE = "나가면 상대가 기다리게 돼요";
```

- [ ] **Step 4: 컴포넌트 작성**

`components/games/game-controls/game-controls.tsx`:

```tsx
"use client";

import { ArrowLeft, Pause } from "lucide-react";
import Link from "next/link";
import { useEffect, useEffectEvent, useState } from "react";

import { Button, buttonVariants } from "@/components/inputs/button";
import { Dialog } from "@/components/overlay/dialog";
import { cn } from "@/lib";

import { ROUND_BUTTON } from "./constants";
import type { GameControlsProps } from "./type";

function stopPropagation(event: React.SyntheticEvent) {
  event.stopPropagation();
}

export function GameControls({ pause, onCancelRound, leaveConfirm, className }: GameControlsProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const pausable = pause !== undefined;

  // 멈춘 상태의 Esc는 멈춤 창(Radix)이 닫기 = 이어하기로 처리한다
  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === "Escape" && pause && !pause.paused) pause.onPause();
  });

  const handleVisibilityChange = useEffectEvent(() => {
    if (document.visibilityState === "hidden" && pause && !pause.paused) pause.onPause();
  });

  useEffect(() => {
    if (!pausable) return;
    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [pausable]);

  const backIcon = <ArrowLeft aria-hidden="true" className="size-5" />;
  const backClass = cn(ROUND_BUTTON, "left-4");

  return (
    // 창(Dialog)은 포털이지만 React 트리상 이 div 안이라, 창 내용·창 밖 오버레이 탭까지 여기서 막힌다
    <div className={cn("contents", className)} onPointerDown={stopPropagation} onClick={stopPropagation}>
      {onCancelRound ? (
        <button type="button" aria-label="이번 판 그만하기" onClick={onCancelRound} className={backClass}>
          {backIcon}
        </button>
      ) : leaveConfirm ? (
        <button type="button" aria-label="로비로 돌아가기" onClick={() => setConfirmOpen(true)} className={backClass}>
          {backIcon}
        </button>
      ) : (
        <Link href="/" aria-label="로비로 돌아가기" className={backClass}>
          {backIcon}
        </Link>
      )}

      {pause && (
        <>
          <button type="button" aria-label="일시정지" onClick={pause.onPause} className={cn(ROUND_BUTTON, "right-4")}>
            <Pause aria-hidden="true" className="size-5" />
          </button>

          <Dialog open={pause.paused} onOpenChange={(open) => !open && pause.onResume()}>
            <Dialog.Content showCloseButton={false} className="text-center">
              <Dialog.Title className="text-title-1 font-black">일시정지</Dialog.Title>
              <Dialog.Description>게임을 잠깐 멈췄어요.</Dialog.Description>
              <div className="flex flex-col gap-2">
                <Button type="button" onClick={pause.onResume} className="h-12 w-full text-title-3 font-bold">
                  이어하기
                </Button>
                <Button type="button" variant="outline" onClick={pause.onRestart} className="h-12 w-full">
                  처음부터
                </Button>
                <Link href="/" className={cn(buttonVariants({ variant: "ghost" }), "h-12 w-full")}>
                  로비로
                </Link>
              </div>
            </Dialog.Content>
          </Dialog>
        </>
      )}

      {leaveConfirm && (
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <Dialog.Content showCloseButton={false} className="text-center">
            <Dialog.Title className="text-title-2 font-bold">로비로 나갈까요?</Dialog.Title>
            <Dialog.Description>{leaveConfirm}</Dialog.Description>
            <div className="flex flex-col gap-2">
              <Button type="button" onClick={() => setConfirmOpen(false)} className="h-12 w-full text-title-3 font-bold">
                계속 두기
              </Button>
              <Link href="/" className={cn(buttonVariants({ variant: "outline" }), "h-12 w-full")}>
                나가기
              </Link>
            </div>
          </Dialog.Content>
        </Dialog>
      )}
    </div>
  );
}
```

`components/games/game-controls/index.tsx`:

```tsx
export * from "./constants";
export * from "./game-controls";
export * from "./type";
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `pnpm vitest run game-controls`
Expected: PASS (7 tests)

실패 시 확인할 것: Esc 테스트가 실패하면 Radix가 `document`에서 keydown을 받는지 — `fireEvent.keyDown(dialog, …)`는 버블링으로 document까지 가야 한다. 래퍼 div는 `onPointerDown`/`onClick`만 막고 keydown은 막지 않는다.

- [ ] **Step 6: 타입 체크**

Run: `pnpm tsc --noEmit`
Expected: 출력 없음 (exit 0). `LayoutProps` 오류가 나면 먼저 `pnpm next typegen` 실행 후 다시

- [ ] **Step 7: 커밋**

```powershell
git add components/games/game-controls
git commit -m @'
✨ Feat : 게임 공용 뒤로·일시정지 컨트롤(GameControls)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KBXVYMCphfEypouhwP6Fnb
'@
```

---

### Task 2: 반응속도 — 판 취소

**Files:**
- Modify: `app/games/_games/reaction-time/reaction-time.tsx` (import 7행 근처, ShareButton 블록 185-191행 뒤)
- Test: `app/games/_games/reaction-time/reaction-time.test.tsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`reaction-time.test.tsx`의 `describe("ReactionTime", …)` 안, `describe("시작 화면", …)` 블록 뒤에 추가:

```tsx
  describe("뒤로 버튼", () => {
    function cancelButton() {
      return screen.getByRole("button", { name: "이번 판 그만하기" });
    }

    it("시작 화면에서는 로비로 가는 링크다", () => {
      render(<ReactionTime />);
      expect(screen.getByRole("link", { name: "로비로 돌아가기" })).toHaveAttribute("href", "/");
    });

    it("카운트다운 중 누르면 판을 취소하고 시작 화면으로 돌아간다", async () => {
      render(<ReactionTime />);
      tap();
      fireEvent.pointerDown(cancelButton());
      fireEvent.click(cancelButton());
      expect(getArea()).toHaveAttribute("data-phase", "idle");

      await advance(COUNTDOWN_STEP_MS * COUNTDOWN_VALUES.length);
      expect(getArea()).toHaveAttribute("data-phase", "idle");
    });

    it("측정 중 누르면 기록을 남기지 않고 시작 화면으로 돌아간다", async () => {
      render(<ReactionTime />);
      await startAndFinishCountdown();
      fireEvent.pointerDown(cancelButton());
      fireEvent.click(cancelButton());
      expect(getArea()).toHaveAttribute("data-phase", "idle");
      expect(window.localStorage.getItem("reaction-time-records")).toBeNull();
    });

    it("너무 빨랐어요 화면에서는 로비로 가는 링크다", () => {
      render(<ReactionTime />);
      tap();
      tap();
      expect(getArea()).toHaveAttribute("data-phase", "too-soon");
      expect(screen.getByRole("link", { name: "로비로 돌아가기" })).toHaveAttribute("href", "/");
    });
  });
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm vitest run reaction-time`
Expected: FAIL — `Unable to find an accessible element with the role "link" and name "로비로 돌아가기"`

- [ ] **Step 3: 구현**

import 추가 (`import { ShareButton } from "@/components/games/share-button";` 바로 아래):

```tsx
import { GameControls } from "@/components/games/game-controls";
```

(알파벳 순서상 `game-controls`가 `share-button`보다 앞이므로 실제로는 그 줄 **위**에 둔다.)

ShareButton 블록(`{phase === "idle" && (<ShareButton … />)}`) 바로 뒤에:

```tsx
      <GameControls
        onCancelRound={phase === "countdown" || phase === "running" ? () => setPhase("idle") : undefined}
      />
```

카운트다운 타이머는 `[phase]` effect cleanup이, `RunningTimer`는 언마운트가 정리한다. 시작 화면 제목은 이미 `px-12`라 왼쪽 위 버튼과 겹치지 않는다.

- [ ] **Step 4: 통과 확인**

Run: `pnpm vitest run reaction-time`
Expected: PASS (기존 테스트 + 새 4개)

- [ ] **Step 5: 커밋**

```powershell
git add app/games/_games/reaction-time
git commit -m @'
✨ Feat : 반응속도 뒤로 버튼 (플레이 중엔 판 취소)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KBXVYMCphfEypouhwP6Fnb
'@
```

---

### Task 3: 클릭 스피드 — 판 취소

**Files:**
- Modify: `app/games/_games/click-speed/click-speed.tsx` (import 7행 근처, `startCountdown` 125-128행 근처, ShareButton 블록 221-227행 뒤)
- Test: `app/games/_games/click-speed/click-speed.test.tsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`click-speed.test.tsx`의 `describe("ClickSpeed", …)` 안, `describe("시작 화면", …)` 뒤에 추가:

```tsx
  describe("뒤로 버튼", () => {
    it("시작 화면에서는 로비로 가는 링크다", () => {
      render(<ClickSpeed />);
      expect(screen.getByRole("link", { name: "로비로 돌아가기" })).toHaveAttribute("href", "/");
    });

    it("연타 중 누르면 기록을 남기지 않고 시작 화면으로 돌아간다", async () => {
      render(<ClickSpeed />);
      await startPlaying();
      await tapTimes(3, 100);

      const cancel = screen.getByRole("button", { name: "이번 판 그만하기" });
      fireEvent.pointerDown(cancel);
      fireEvent.click(cancel);
      expect(getScreenEl()).toHaveAttribute("data-phase", "idle");

      await advance(IDLE_STOP_MS);
      expect(getScreenEl()).toHaveAttribute("data-phase", "idle");
      expect(window.localStorage.getItem("click-speed-records")).toBeNull();
    });
  });
```

(두 번째 테스트의 `fireEvent.click(cancel)`이 루트로 새면 `handleClick`이 idle에서 카운트다운을 시작해 `data-phase`가 `countdown`이 되므로 전파 차단도 함께 확인된다.)

- [ ] **Step 2: 실패 확인**

Run: `pnpm vitest run click-speed`
Expected: FAIL — role "link" name "로비로 돌아가기" 없음

- [ ] **Step 3: 구현**

import 추가 (`share-button` import 위):

```tsx
import { GameControls } from "@/components/games/game-controls";
```

`startCountdown` 함수 바로 아래에:

```tsx
  function cancelRound() {
    setCount(0);
    setRipples([]);
    setFirstTapAt(null);
    setPhase("idle");
  }
```

ShareButton 블록(`{phase === "idle" && (<ShareButton … />)}`) 바로 뒤에:

```tsx
      <GameControls onCancelRound={phase === "countdown" || phase === "playing" ? cancelRound : undefined} />
```

멈춤 판정 타이머(`[phase, count]` effect)는 phase가 바뀌며 정리되므로 `finishRound`(기록 저장)가 불리지 않는다.

- [ ] **Step 4: 통과 확인**

Run: `pnpm vitest run click-speed`
Expected: PASS

- [ ] **Step 5: 커밋**

```powershell
git add app/games/_games/click-speed
git commit -m @'
✨ Feat : 클릭 스피드 뒤로 버튼 (플레이 중엔 판 취소)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KBXVYMCphfEypouhwP6Fnb
'@
```

---

### Task 4: 몰래 먹기 — 일시정지

**Files:**
- Modify: `app/games/_games/capybara-sneak/capybara-sneak.tsx`
  - import(6-9행), state(78-82행), 주인 effect(126-151행), 먹기 effect(154-167행), 감소 effect(170-183행), `startPress`(186-190행), `restart`(223-232행), 게이지 패널 클래스(361행), 결과 `Dialog`(383행) 앞
- Test: `app/games/_games/capybara-sneak/capybara-sneak.test.tsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`capybara-sneak.test.tsx` 상단 import에 `EAT_DELAY_MS`는 이미 있다. `describe("CapybaraSneak", …)` 안 마지막에 추가:

```tsx
  describe("일시정지", () => {
    function pauseButton() {
      return screen.getByRole("button", { name: "일시정지" });
    }

    it("시작 전에는 일시정지 버튼 없이 로비 링크만 있다", () => {
      render(<CapybaraSneak />);
      expect(screen.queryByRole("button", { name: "일시정지" })).toBeNull();
      expect(screen.getByRole("link", { name: "로비로 돌아가기" })).toHaveAttribute("href", "/");
    });

    it("멈춘 동안에는 게이지도 주인도 움직이지 않고, 이어하면 다시 움직인다", async () => {
      render(<CapybaraSneak />);
      press();
      await advance(EAT_DELAY_MS);
      const eaten = gaugeValue();
      expect(eaten).toBeGreaterThan(0);

      fireEvent.click(pauseButton());
      await advance(10_000);
      expect(gaugeValue()).toBe(eaten);
      expect(ownerState()).toBe("away");
      expect(screen.queryByText("들켰다!")).toBeNull();

      fireEvent.click(screen.getByRole("button", { name: "이어하기" }));
      release();
      await advance(TURNING_AT);
      expect(ownerState()).toBe("turning");
    });

    it("주인이 보고 있을 때 멈췄다 이어해도 바로 들키지 않는다", async () => {
      expect(EAT_DELAY_MS).toBeLessThan(TURNING_AT);
      render(<CapybaraSneak />);
      press();
      release();
      await advance(LOOKING_AT);
      expect(ownerState()).toBe("looking");

      fireEvent.click(pauseButton());
      expect(ownerState()).toBe("away");

      fireEvent.click(screen.getByRole("button", { name: "이어하기" }));
      press();
      await advance(EAT_DELAY_MS);
      expect(gaugeValue()).toBeGreaterThan(0);
      expect(screen.queryByText("들켰다!")).toBeNull();
    });

    it("멈춘 상태에서 처음부터를 누르면 창이 닫히고 시작 전으로 돌아간다", async () => {
      render(<CapybaraSneak />);
      press();
      await advance(EAT_DELAY_MS);
      fireEvent.click(pauseButton());

      fireEvent.click(screen.getByRole("button", { name: "처음부터" }));
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(gaugeValue()).toBe(0);
      expect(screen.queryByRole("button", { name: "일시정지" })).toBeNull();
    });
  });
```

(첫 `press()` 뒤 `release()` 없이 멈추면 멈출 때 `pressing`이 풀린다. `EAT_DELAY_MS < TURNING_AT` 전제가 깨지면 두 번째 테스트 첫 줄이 알려준다.)

- [ ] **Step 2: 실패 확인**

Run: `pnpm vitest run capybara-sneak`
Expected: FAIL — role "link" name "로비로 돌아가기" / role "button" name "일시정지" 없음

- [ ] **Step 3: 구현**

import (`@/components/feedback/progress` 아래):

```tsx
import { GameControls } from "@/components/games/game-controls";
```

state (`const [pressing, setPressing] = useState(false);` 아래):

```tsx
  const [paused, setPaused] = useState(false);
```

세 effect의 게이트와 의존성에 `paused` 추가:

```tsx
  useEffect(() => {
    if (status !== "playing" || paused) return;
    // …기존 scheduleAway 본문 그대로…
  }, [status, paused]);
```

```tsx
  useEffect(() => {
    if (!pressing || status !== "playing" || paused) return;
    // …기존 본문 그대로…
  }, [pressing, status, paused]);
```

```tsx
  useEffect(() => {
    if (pressing || status !== "playing" || paused) return;
    // …기존 본문 그대로…
  }, [pressing, status, paused]);
```

`startPress` 첫 줄에 (키보드 Space/Enter는 래퍼 전파 차단을 거치지 않으므로):

```tsx
    if (paused) return;
```

`restart` 함수 아래에:

```tsx
  // 주인은 등 돌린 상태로 되돌린다 — scheduleAway()는 away에서 시작한다고 보고 짜여 있어,
  // looking 중에 멈췄다 이어하면 첫 입에 바로 들키기 때문
  function pauseGame() {
    ownerRef.current = "away";
    setOwnerState("away");
    setPressing(false);
    setPaused(true);
  }
```

`restart` 본문 마지막 줄(`setPressing(false);`) 뒤에 추가 (결과 창의 "다시 하기"와 멈춤 창의 "처음부터"가 같은 경로):

```tsx
    setPaused(false);
```

게이지 패널(`data-testid="gauge-panel"`) 클래스에서 `w-[min(32rem,calc(100%-2rem))]` → `w-[min(32rem,calc(100%-8rem))]`

결과 `<Dialog open={isOver} …>` 바로 앞에:

```tsx
      <GameControls
        pause={
          status === "playing"
            ? { paused, onPause: pauseGame, onResume: () => setPaused(false), onRestart: restart }
            : undefined
        }
      />
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm vitest run capybara-sneak`
Expected: PASS (기존 + 새 4개)

- [ ] **Step 5: 커밋**

```powershell
git add app/games/_games/capybara-sneak
git commit -m @'
✨ Feat : 몰래 먹기 일시정지·뒤로 버튼

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KBXVYMCphfEypouhwP6Fnb
'@
```

---

### Task 5: 통나무 피하기 — 일시정지 (rAF)

**Files:**
- Modify: `app/games/_games/capybara-log-dodge/capybara-log-dodge.tsx`
  - import(8행 근처 share-button), state/ref(163-174행), `finishRound`(194-209행), `tick`(245-271행), `startCountdown`(282-287행), 포인터·키 핸들러(290-326행), 루트 div(372-385행), HUD 컨테이너(484행), 루트 닫는 `</div>`(573행) 앞
- Test: `app/games/_games/capybara-log-dodge/capybara-log-dodge.test.tsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`capybara-log-dodge.test.tsx`의 `describe` 마지막에 추가 (jsdom은 `canvas.getContext`가 null이라 rAF 루프는 돌지 않는다 — 멈춤 상태 전환만 검사):

```tsx
  describe("일시정지", () => {
    async function startPlaying() {
      vi.useFakeTimers();
      render(<CapybaraLogDodge />);
      fireEvent.click(gameScreen());
      await act(async () => {
        vi.advanceTimersByTime(COUNTDOWN_STEP_MS * COUNTDOWN_VALUES.length);
      });
      expect(gameScreen()).toHaveAttribute("data-phase", "playing");
    }

    it("시작 화면에는 일시정지 버튼 없이 로비 링크만 있다", () => {
      render(<CapybaraLogDodge />);
      expect(screen.queryByRole("button", { name: "일시정지" })).toBeNull();
      expect(screen.getByRole("link", { name: "로비로 돌아가기" })).toHaveAttribute("href", "/");
    });

    it("플레이 중 일시정지 버튼·Esc로 멈추고 이어하기로 돌아온다", async () => {
      await startPlaying();
      fireEvent.click(screen.getByRole("button", { name: "일시정지" }));
      expect(gameScreen()).toHaveAttribute("data-paused", "true");
      expect(gameScreen()).toHaveAttribute("data-phase", "playing");

      fireEvent.click(screen.getByRole("button", { name: "이어하기" }));
      expect(gameScreen()).toHaveAttribute("data-paused", "false");

      fireEvent.keyDown(window, { key: "Escape" });
      expect(gameScreen()).toHaveAttribute("data-paused", "true");
    });

    it("멈춘 상태에서 처음부터를 누르면 카운트다운부터 다시 한다", async () => {
      await startPlaying();
      fireEvent.click(screen.getByRole("button", { name: "일시정지" }));
      fireEvent.click(screen.getByRole("button", { name: "처음부터" }));
      expect(gameScreen()).toHaveAttribute("data-phase", "countdown");
      expect(gameScreen()).toHaveAttribute("data-paused", "false");
    });
  });
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm vitest run capybara-log-dodge`
Expected: FAIL — role "link" name "로비로 돌아가기" 없음

- [ ] **Step 3: 구현**

import (`share-button` import 위):

```tsx
import { GameControls } from "@/components/games/game-controls";
```

state (`const [hud, setHud] = useState<Hud | null>(null);` 아래):

```tsx
  const [paused, setPaused] = useState(false);
```

ref (`const scaleRef = useRef(1);` 아래):

```tsx
  /** rAF 루프는 렌더링과 상관없이 돌아서 멈춤 여부를 ref로 읽는다 */
  const pausedRef = useRef(false);
```

`useInView` 줄 아래에:

```tsx
  // 멈출 때 입력을 비운다 — 방향키를 누른 채 멈추면 keyup을 놓쳐 이어할 때 한쪽으로 흘러간다
  function changePaused(next: boolean) {
    pausedRef.current = next;
    setPaused(next);
    if (next) {
      keysRef.current = { left: false, right: false };
      dragRef.current = null;
    }
  }
```

`finishRound` 본문 첫 줄에 (피격 `HIT_PAUSE_MS` 타이머가 멈춤과 겹쳐도 결과 화면에 멈춤 창이 남지 않게):

```tsx
    changePaused(false);
```

`tick` 안, `if (!state || !ctx) return;` 바로 아래에:

```tsx
      if (pausedRef.current) {
        // step은 건너뛰고 기준 시각만 옮긴다 → 이어할 때 시간이 튀지 않음. 멈춘 동안 resize로 캔버스가 지워져도 다시 그림
        lastAt = now;
        draw(ctx, state, sprites, Math.max(0, now - startAt), reducedMotion);
        frameId = requestAnimationFrame(tick);
        return;
      }
```

`startCountdown` 본문 첫 줄에:

```tsx
    changePaused(false);
```

`handlePointerDown`의 가드를 `if (phase !== "playing" || !state || pausedRef.current) return;` 로,
`handleKey`의 방향키 가드 `if (phase !== "playing") return;`을 `if (phase !== "playing" || pausedRef.current) return;` 로 바꾼다.

루트 div에 `data-phase={phase}` 다음 줄로:

```tsx
      data-paused={paused}
```

HUD 컨테이너 클래스(`pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center gap-2 px-4 …`)의 `px-4` → `px-16`

결과 블록(`{phase === "result" && result && tier && (…)}`) 뒤, 루트 `</div>` 바로 앞에 (DOM상 `play-area` 뒤라 위에 그려지고, 플레이 중에는 `dark` 스코프로 어두운 캔버스 위 밝은 버튼):

```tsx
      <GameControls
        className={phase === "playing" ? "dark text-foreground" : undefined}
        pause={
          phase === "playing"
            ? {
                paused,
                onPause: () => changePaused(true),
                onResume: () => changePaused(false),
                onRestart: startCountdown,
              }
            : undefined
        }
      />
```

(`onRestart`의 멈춤 해제는 `startCountdown` 첫 줄의 `changePaused(false)`가 맡는다. 멈춘 동안에도 `draw`에 `now - startAt`이 넘어가 달리기 애니메이션은 계속 돈다 — 스펙상 의도된 동작.)

- [ ] **Step 4: 통과 확인**

Run: `pnpm vitest run capybara-log-dodge`
Expected: PASS (기존 4개 + 새 3개). `Not implemented: HTMLCanvasElement's getContext()` 경고는 기존에도 나오는 jsdom 한계

- [ ] **Step 5: 커밋**

```powershell
git add app/games/_games/capybara-log-dodge
git commit -m @'
✨ Feat : 통나무 피하기 일시정지·뒤로 버튼

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KBXVYMCphfEypouhwP6Fnb
'@
```

---

### Task 6: 비행기 슈팅 — 일시정지 (rAF)

**Files:**
- Modify: `app/games/_games/capybara-plane-shooter/capybara-plane-shooter.tsx`
  - import(8행 share-button), state/ref(245-255행), `finishRound`(279-287행), `tick`(323-350행), `startCountdown`(362-367행), 포인터·키 핸들러(370-408행), 루트 div(443-456행), HUD 컨테이너(532행), 루트 닫는 `</div>`(627행) 앞
- Create: `app/games/_games/capybara-plane-shooter/capybara-plane-shooter.test.tsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`app/games/_games/capybara-plane-shooter/capybara-plane-shooter.test.tsx` (새 파일):

```tsx
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mockIntersectionObserver } from "@/lib/games/testing/mock-intersection-observer";

import { CapybaraPlaneShooter, COUNTDOWN_STEP_MS, COUNTDOWN_VALUES } from "./capybara-plane-shooter";

function gameScreen() {
  return screen.getByTestId("capybara-plane-shooter-screen");
}

describe("CapybaraPlaneShooter 일시정지", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockIntersectionObserver();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  async function startPlaying() {
    render(<CapybaraPlaneShooter />);
    fireEvent.click(gameScreen());
    await act(async () => {
      vi.advanceTimersByTime(COUNTDOWN_STEP_MS * COUNTDOWN_VALUES.length);
    });
    expect(gameScreen()).toHaveAttribute("data-phase", "playing");
  }

  it("시작 화면에는 일시정지 버튼 없이 로비 링크만 있다", () => {
    render(<CapybaraPlaneShooter />);
    expect(screen.queryByRole("button", { name: "일시정지" })).toBeNull();
    expect(screen.getByRole("link", { name: "로비로 돌아가기" })).toHaveAttribute("href", "/");
  });

  it("플레이 중 일시정지로 멈추고 이어하기로 돌아온다", async () => {
    await startPlaying();
    fireEvent.click(screen.getByRole("button", { name: "일시정지" }));
    expect(gameScreen()).toHaveAttribute("data-paused", "true");

    fireEvent.click(screen.getByRole("button", { name: "이어하기" }));
    expect(gameScreen()).toHaveAttribute("data-paused", "false");
  });

  it("멈춘 상태에서 처음부터를 누르면 카운트다운부터 다시 한다", async () => {
    await startPlaying();
    fireEvent.click(screen.getByRole("button", { name: "일시정지" }));
    fireEvent.click(screen.getByRole("button", { name: "처음부터" }));
    expect(gameScreen()).toHaveAttribute("data-phase", "countdown");
    expect(gameScreen()).toHaveAttribute("data-paused", "false");
  });
});
```

(`COUNTDOWN_VALUES`·`COUNTDOWN_STEP_MS`는 `capybara-plane-shooter.tsx` 50-51행에서 export된다.)

- [ ] **Step 2: 실패 확인**

Run: `pnpm vitest run capybara-plane-shooter`
Expected: FAIL — role "link" name "로비로 돌아가기" 없음 (logic·sprites 기존 테스트는 PASS)

- [ ] **Step 3: 구현**

Task 5와 같은 패턴. 차이만 적는다.

import (`share-button` import 위):

```tsx
import { GameControls } from "@/components/games/game-controls";
```

state (`const [hud, setHud] = useState<Hud | null>(null);` 아래) / ref (`const scaleRef = useRef(1);` 아래) / `changePaused`(`useInView` 줄 아래) — Task 5 Step 3과 **같은 코드**(`paused`, `pausedRef`, `changePaused`). `dragRef` 모양은 다르지만 `null` 대입이라 그대로 된다.

`finishRound` 본문 첫 줄, `startCountdown` 본문 첫 줄에 `changePaused(false);`

`tick` 안, `if (!state || !ctx) return;` 바로 아래에:

```tsx
        if (pausedRef.current) {
          // step은 건너뛰고 기준 시각만 옮긴다 → 이어할 때 시간이 튀지 않음. 멈춘 동안 resize로 캔버스가 지워져도 다시 그림
          lastAt = now;
          draw(ctx, state, sprites, palette, Math.max(0, now - startAt), reducedMotion);
          frameId = requestAnimationFrame(tick);
          return;
        }
```

`handlePointerDown` 가드 → `if (phase !== "playing" || !state || pausedRef.current) return;`
`handleKey` 방향키 가드 → `if (phase !== "playing" || pausedRef.current) return;`

루트 div `data-phase={phase}` 다음 줄에 `data-paused={paused}`

HUD 컨테이너(`pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 px-4 …`)의 `px-4` → `px-16` (왼쪽 하트·오른쪽 점수가 컨트롤 옆으로)

결과 블록 뒤, 루트 `</div>` 바로 앞에 — Task 5와 같은 `<GameControls className=… pause=… />` 블록

- [ ] **Step 4: 통과 확인**

Run: `pnpm vitest run capybara-plane-shooter`
Expected: PASS (새 3개 + 기존 logic/sprites)

- [ ] **Step 5: 커밋**

```powershell
git add app/games/_games/capybara-plane-shooter
git commit -m @'
✨ Feat : 비행기 슈팅 일시정지·뒤로 버튼

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KBXVYMCphfEypouhwP6Fnb
'@
```

---

### Task 7: 바둑·오목(CapybaraRoom) — 나가기 확인

**Files:**
- Modify: `components/games/capybara-room/capybara-room.tsx` (import 7행 근처, 상단 컨테이너 167행, 결과 `Dialog` 320행 앞)
- Test: `components/games/capybara-room/capybara-room.test.tsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`capybara-room.test.tsx` 끝에 추가:

```tsx
describe("CapybaraRoom 뒤로 버튼", () => {
  it("대국 중에는 나가기 전에 확인 창을 띄운다", () => {
    renderRoom(viewAs("white"));
    fireEvent.click(screen.getByRole("button", { name: "로비로 돌아가기" }));
    expect(screen.getByText("나가면 상대가 기다리게 돼요")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "나가기" })).toHaveAttribute("href", "/");
  });

  it("관전자는 확인 없이 바로 로비로 간다", () => {
    renderRoom(viewAs(null));
    expect(screen.getByRole("link", { name: "로비로 돌아가기" })).toHaveAttribute("href", "/");
  });

  it("상대를 기다리는 중에는 확인 없이 바로 로비로 간다", () => {
    renderRoom({ ...viewAs("black"), joined: { black: true, white: false } });
    expect(screen.getByRole("link", { name: "로비로 돌아가기" })).toHaveAttribute("href", "/");
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm vitest run capybara-room`
Expected: FAIL — role "button"/"link" name "로비로 돌아가기" 없음

- [ ] **Step 3: 구현**

import (`@/components/feedback/progress` 아래):

```tsx
import { GameControls, LEAVE_CONFIRM_MESSAGE } from "@/components/games/game-controls";
```

상단 컨테이너(`absolute inset-0 flex flex-col items-center gap-3 pt-[max(1rem,env(safe-area-inset-top))] …`)의 `pt-[max(1rem,env(safe-area-inset-top))]` → `pt-[calc(max(1rem,env(safe-area-inset-top))_+_3.5rem)]` (카드를 버튼 줄 아래로)

결과 `<Dialog open={isOver} …>` 바로 앞에:

```tsx
      <GameControls
        leaveConfirm={view?.you && view.joined.white && !state?.endReason ? LEAVE_CONFIRM_MESSAGE : undefined}
      />
```

`<Link href="/">`로 나가면 `?code`가 사라져 다시 들어와도 자동 재참가하지 않는다 — 확인 문구가 이를 전제로 한다. 서버에 자리 비우기 알림은 범위 밖.

- [ ] **Step 4: 통과 확인**

Run: `pnpm vitest run capybara-room`
Expected: PASS

- [ ] **Step 5: 커밋**

```powershell
git add components/games/capybara-room
git commit -m @'
✨ Feat : 바둑·오목 뒤로 버튼 (대국 중엔 나가기 확인)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KBXVYMCphfEypouhwP6Fnb
'@
```

---

### Task 8: 알까기 — 나가기 확인

**Files:**
- Modify: `app/games/_games/capybara-alkkagi/capybara-alkkagi.tsx` (import 17행 `@/components/games/capybara-room` 아래, 상단 컨테이너 336행, 결과 `Dialog` 545행 앞)

알까기는 컴포넌트 테스트가 없다. 같은 prop 한 줄이라 Task 7 테스트와 `tsc`로 갈음한다.

- [ ] **Step 1: 구현**

import (`import { EmoteBubble, EmotePicker, TurnTimer, useEmoteShowing } from "@/components/games/capybara-room";` 아래):

```tsx
import { GameControls, LEAVE_CONFIRM_MESSAGE } from "@/components/games/game-controls";
```

상단 컨테이너의 `pt-[max(1rem,env(safe-area-inset-top))]` → `pt-[calc(max(1rem,env(safe-area-inset-top))_+_3.5rem)]`

결과 `<Dialog open={isOver} …>` 바로 앞에:

```tsx
      <GameControls
        leaveConfirm={view?.you && view.joined.white && !state?.endReason ? LEAVE_CONFIRM_MESSAGE : undefined}
      />
```

- [ ] **Step 2: 타입 체크**

Run: `pnpm tsc --noEmit`
Expected: 출력 없음 (exit 0)

- [ ] **Step 3: 커밋**

```powershell
git add app/games/_games/capybara-alkkagi
git commit -m @'
✨ Feat : 알까기 뒤로 버튼 (대국 중엔 나가기 확인)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KBXVYMCphfEypouhwP6Fnb
'@
```

---

### Task 9: 전체 검증

**Files:** 없음 (확인만)

- [ ] **Step 1: 타입 체크**

Run: `pnpm tsc --noEmit`
Expected: exit 0

- [ ] **Step 2: 관련 테스트 전체**

Run: `pnpm vitest run game-controls share-button reaction-time click-speed capybara-sneak capybara-log-dodge capybara-plane-shooter capybara-room capybara-gomoku capybara-baduk capybara-alkkagi`
Expected: 모두 PASS

- [ ] **Step 3: 전체 테스트**

Run: `pnpm vitest run`
Expected: 모두 PASS (실패하면 이 작업과 무관한 기존 실패인지 `git stash` 없이 `git log`로 확인 — 기존 실패면 보고만)

- [ ] **Step 4: 브라우저 수동 확인**

`pnpm dev` 후 확인 (단위 테스트로 못 잡는 부분):

- [ ] 멈춤 창 **바깥(어두운 오버레이)을 탭**하면 이어하기되고, 그 탭이 게임 입력(몰래 먹기 누르기, 슈팅 드래그 시작)으로 새지 않는다
- [ ] 비행기 슈팅·통나무 피하기에서 방향키를 누른 채 `Esc` → 키를 뗀 뒤 이어하기 → 캐릭터가 한쪽으로 흘러가지 않는다
- [ ] 멈춘 채 창 크기를 바꿔도(가로·세로 회전) 캔버스가 비지 않는다
- [ ] 플레이 중 다른 탭으로 갔다 오면 멈춤 창이 떠 있다
- [ ] **라이트 테마**(OS 라이트)에서 비행기 슈팅·통나무 피하기 플레이 중 뒤로·일시정지 버튼이 어두운 캔버스 위에서 밝게 보인다
- [ ] **375px 폭(iPhone SE)**: 몰래 먹기 게이지, 바둑·오목·알까기 상단 카드, 슈팅 하트·점수, 통나무 시간 알약이 버튼과 겹치지 않는다
- [ ] 반응속도·클릭 스피드 시작/결과 화면의 뒤로 버튼으로 로비에 가면 들어갔던 오두막 문 앞에서 다시 시작한다
- [ ] 키보드 Tab으로 뒤로·일시정지 버튼에 포커스 링이 보이고 Enter/Space로 동작한다 (반응속도에서 Enter가 판 시작으로 새지 않음)
- [ ] 멈춤 창·확인 창에 광고가 없다

- [ ] **Step 5: push**

```powershell
git push
```
