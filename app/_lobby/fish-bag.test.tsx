import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FishBag } from "./fish-bag";
import { LobbyMenu } from "./lobby-menu";

describe("낚시 가방", () => {
  it("포만감을 표시하고 배가 가득 차면 먹이 버튼을 막는다", () => {
    const onFeed = vi.fn();
    render(
      <LobbyMenu name="카피">
        <FishBag inventory={{ 사과: 1 }} satiety={{ value: 100, at: Date.now() }} onFeed={onFeed} />
      </LobbyMenu>,
    );

    fireEvent.click(screen.getByRole("button", { name: "낚시 가방 (1번 낚음)" }));

    expect(screen.getByLabelText("카피바라 포만감")).toHaveAttribute("aria-valuenow", "100");
    expect(screen.getByRole("button", { name: "사과 먹이기 불가, 배부름" })).toBeDisabled();
    expect(onFeed).not.toHaveBeenCalled();
  });
});
