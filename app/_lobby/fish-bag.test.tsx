import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FishBag } from "./fish-bag";

describe("낚시 가방", () => {
  it("포만감과 애정도를 표시하고 배가 가득 차면 먹이 버튼을 막는다", () => {
    const onFeed = vi.fn();
    render(<FishBag inventory={{ 메기: 1 }} satiety={{ value: 100, at: Date.now() }} affection={37} onFeed={onFeed} />);

    expect(screen.getByLabelText("카피바라 포만감")).toHaveAttribute("aria-valuenow", "100");
    expect(screen.getByLabelText("카피바라 애정도")).toHaveAttribute("aria-valuenow", "37");
    expect(screen.getByRole("button", { name: "메기 먹이기 불가, 배부름" })).toBeDisabled();
    expect(screen.getByText("포만 +20 · 애정 +3")).toBeInTheDocument();
    expect(onFeed).not.toHaveBeenCalled();
  });
});
