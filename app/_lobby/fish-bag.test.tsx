import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FishBag } from "./fish-bag";

describe("낚시 가방", () => {
  it("포만감을 표시하고, 사과만 먹일 수 있으며 배가 가득 차면 먹이 버튼을 막는다", () => {
    const onFeed = vi.fn();
    const { rerender } = render(<FishBag inventory={{ 메기: 1, 사과: 2 }} satiety={{ value: 100, at: Date.now() }} onFeed={onFeed} />);

    expect(screen.getByLabelText("카피바라 포만감")).toHaveAttribute("aria-valuenow", "100");
    expect(screen.getByRole("button", { name: "사과 먹이기 불가, 배부름" })).toBeDisabled();
    // 카피바라는 초식동물이라 물고기는 모아 보기만 한다
    expect(screen.queryByRole("button", { name: /메기/ })).toBeNull();
    expect(screen.getByText("포만 +10")).toBeInTheDocument();

    rerender(<FishBag inventory={{ 메기: 1, 사과: 2 }} satiety={{ value: 0, at: Date.now() }} onFeed={onFeed} />);
    fireEvent.click(screen.getByRole("button", { name: "사과 먹이기 (2개)" }));
    expect(onFeed).toHaveBeenCalledWith("사과");
  });
});
