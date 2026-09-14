import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock }));
const recordGameShareMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/games/supabase", () => ({ recordGameShare: recordGameShareMock }));

import { ShareButton } from "./share-button";

function setNavigator(
  key: "share" | "clipboard",
  value: Navigator["share"] | Partial<Clipboard> | undefined,
) {
  Object.defineProperty(window.navigator, key, { value, configurable: true, writable: true });
}

function renderButton() {
  render(<ShareButton title="반응속도 테스트" text="182ms 게이머 등급! 너도 도전해 봐" />);
  return screen.getByRole("button", { name: "공유하기" });
}

describe("ShareButton", () => {
  afterEach(() => {
    setNavigator("share", undefined);
    setNavigator("clipboard", undefined);
    vi.clearAllMocks();
  });

  it("공유 기능이 있는 기기에서는 기본 공유 창을 연다", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setNavigator("share", share);

    fireEvent.click(renderButton());

    await waitFor(() =>
      expect(share).toHaveBeenCalledWith({
        title: "반응속도 테스트",
        text: "182ms 게이머 등급! 너도 도전해 봐",
        url: window.location.href,
      }),
    );
  });

  it("공유 창을 사용자가 닫으면 아무것도 하지 않는다", async () => {
    const share = vi.fn().mockRejectedValue(new DOMException("cancel", "AbortError"));
    const writeText = vi.fn().mockResolvedValue(undefined);
    setNavigator("share", share);
    setNavigator("clipboard", { writeText });

    fireEvent.click(renderButton());

    await waitFor(() => expect(share).toHaveBeenCalled());
    expect(recordGameShareMock).not.toHaveBeenCalled();
    expect(writeText).not.toHaveBeenCalled();
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it("공유 기능이 없으면 문구와 링크를 복사하고 알려준다", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setNavigator("clipboard", { writeText });

    fireEvent.click(renderButton());

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(`182ms 게이머 등급! 너도 도전해 봐 ${window.location.href}`),
    );
    expect(toastMock.success).toHaveBeenCalledWith("링크를 복사했어요");
  });

  it("게임 페이지에서 공유를 마치면 방법별로 공유 수를 기록한다", async () => {
    window.history.pushState({}, "", "/games/reaction-time");
    setNavigator("share", vi.fn().mockResolvedValue(undefined));
    fireEvent.click(renderButton());
    await waitFor(() => expect(recordGameShareMock).toHaveBeenCalledWith("reaction-time", "native"));

    setNavigator("share", undefined);
    setNavigator("clipboard", { writeText: vi.fn().mockResolvedValue(undefined) });
    fireEvent.click(screen.getAllByRole("button", { name: "공유하기" })[0]);
    await waitFor(() => expect(recordGameShareMock).toHaveBeenCalledWith("reaction-time", "clipboard"));
    window.history.pushState({}, "", "/");
  });

  it("복사도 실패하면 직접 복사하도록 안내한다", async () => {
    setNavigator("clipboard", { writeText: vi.fn().mockRejectedValue(new Error("denied")) });

    fireEvent.click(renderButton());

    await waitFor(() => expect(toastMock.error).toHaveBeenCalled());
  });

  it("눌러도 뒤에 있는 게임 화면으로 이벤트가 전달되지 않는다", () => {
    const onPointerDown = vi.fn();
    const onClick = vi.fn();
    render(
      <div onPointerDown={onPointerDown} onClick={onClick}>
        <ShareButton title="t" text="x" />
      </div>,
    );

    const button = screen.getByRole("button", { name: "공유하기" });
    fireEvent.pointerDown(button);
    fireEvent.click(button);

    expect(onPointerDown).not.toHaveBeenCalled();
    expect(onClick).not.toHaveBeenCalled();
  });
});
