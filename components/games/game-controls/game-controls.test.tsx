import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GameControls } from "./game-controls";

function pauseProps(paused: boolean) {
  return { paused, onPause: vi.fn(), onResume: vi.fn(), onRestart: vi.fn() };
}

function StatefulPauseGame() {
  const [paused, setPaused] = useState(false);
  return (
    <GameControls
      pause={{
        paused,
        onPause: () => setPaused(true),
        onResume: () => setPaused(false),
        onRestart: () => {},
      }}
    />
  );
}

function setVisibility(value: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", { value, configurable: true });
}

describe("GameControls", () => {
  afterEach(() => {
    setVisibility("visible");
    window.localStorage.clear();
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

  it("leaveConfirm이 사라졌다 다시 생겨도 확인 창이 저절로 열리지 않는다", () => {
    const message = "나가면 상대가 기다리게 돼요";
    const { rerender } = render(<GameControls leaveConfirm={message} />);
    fireEvent.click(screen.getByRole("button", { name: "로비로 돌아가기" }));
    expect(screen.getByText(message)).toBeInTheDocument();

    rerender(<GameControls />);
    rerender(<GameControls leaveConfirm={message} />);

    expect(screen.queryByText(message)).toBeNull();
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

  it("멈춤 창에서 Esc로 닫으면 같은 키 이벤트로 다시 멈추지 않는다", () => {
    render(<StatefulPauseGame />);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("효과음 버튼으로 로비와 같은 소리 설정을 켜고 끈다", () => {
    window.localStorage.setItem("ggpli:lobby-settings", JSON.stringify({ muted: true, volume: 0.6, showHelp: true }));
    render(<GameControls />);

    const sound = screen.getByRole("button", { name: "효과음" });
    expect(sound).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(sound);
    expect(sound).toHaveAttribute("aria-pressed", "true");
    expect(JSON.parse(window.localStorage.getItem("ggpli:lobby-settings") ?? "{}")).toMatchObject({ muted: false, volume: 0.6 });

    fireEvent.click(sound);
    expect(sound).toHaveAttribute("aria-pressed", "false");
  });

  it("음량 0으로 저장돼 있어도(로비 슬라이더를 0으로 내림) 효과음 버튼으로 켜면 들리는 음량으로 켜진다", () => {
    window.localStorage.setItem("ggpli:lobby-settings", JSON.stringify({ muted: false, volume: 0, showHelp: true }));
    render(<GameControls />);

    const sound = screen.getByRole("button", { name: "효과음" });
    expect(sound).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(sound);
    expect(sound).toHaveAttribute("aria-pressed", "true");
    expect(JSON.parse(window.localStorage.getItem("ggpli:lobby-settings") ?? "{}")).toMatchObject({ muted: false, volume: 0.6 });
  });

  it("멈춤 창 슬라이더를 0으로 내리면 끄되 음량은 남겨, 효과음 버튼으로 다시 켜면 그 음량이다", () => {
    window.localStorage.setItem("ggpli:lobby-settings", JSON.stringify({ muted: false, volume: 0.4, showHelp: true }));
    render(<GameControls pause={pauseProps(true)} />);

    fireEvent.change(screen.getByRole("slider", { name: /효과음 크기/ }), { target: { value: "0" } });
    expect(JSON.parse(window.localStorage.getItem("ggpli:lobby-settings") ?? "{}")).toMatchObject({ muted: true, volume: 0.4 });

    fireEvent.click(screen.getByRole("button", { name: "효과음", hidden: true }));
    expect(JSON.parse(window.localStorage.getItem("ggpli:lobby-settings") ?? "{}")).toMatchObject({ muted: false, volume: 0.4 });
  });

  it("멈춤 창의 효과음 크기를 바꾸면 저장되고, 음소거였으면 소리도 켜진다", () => {
    window.localStorage.setItem("ggpli:lobby-settings", JSON.stringify({ muted: true, volume: 0.6, showHelp: true }));
    render(<GameControls pause={pauseProps(true)} />);

    fireEvent.change(screen.getByRole("slider", { name: /효과음 크기/ }), { target: { value: "30" } });
    expect(JSON.parse(window.localStorage.getItem("ggpli:lobby-settings") ?? "{}")).toMatchObject({ muted: false, volume: 0.3 });
    expect(screen.getByRole("button", { name: "효과음", hidden: true })).toHaveAttribute("aria-pressed", "true");
  });

  it("플레이 중 다른 열린 창(나가기 확인)을 Esc로 닫아도 게임이 멈추지 않는다", () => {
    const pause = pauseProps(false);
    render(<GameControls pause={pause} leaveConfirm="나가면 상대가 기다리게 돼요" />);

    fireEvent.click(screen.getByRole("button", { name: "로비로 돌아가기" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.keyDown(dialog, { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(pause.onPause).not.toHaveBeenCalled();
  });
});
