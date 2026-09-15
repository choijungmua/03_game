import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { GameOverActions } from "./game-over-actions";

describe("GameOverActions", () => {
  it("다시 하기는 onRetry를 부르고, 홈으로는 로비(/) 링크다", () => {
    const onRetry = vi.fn();
    render(<GameOverActions onRetry={onRetry} />);

    fireEvent.click(screen.getByRole("button", { name: "다시 하기" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("link", { name: "홈으로" })).toHaveAttribute("href", "/");
  });

  it("눌러도 뒤에 있는 게임 화면으로 이벤트가 전달되지 않는다", () => {
    const onPointerDown = vi.fn();
    const onClick = vi.fn();
    render(
      <div onPointerDown={onPointerDown} onClick={onClick}>
        <GameOverActions onRetry={vi.fn()} />
      </div>,
    );

    const retry = screen.getByRole("button", { name: "다시 하기" });
    fireEvent.pointerDown(retry);
    fireEvent.click(retry);

    expect(onPointerDown).not.toHaveBeenCalled();
    expect(onClick).not.toHaveBeenCalled();
  });
});
