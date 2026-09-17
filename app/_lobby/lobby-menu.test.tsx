import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LobbyMenu } from "./lobby-menu";

describe("로비 메뉴", () => {
  it("하나의 진입점으로 열리고 Escape로 닫힌다", () => {
    render(
      <LobbyMenu name="보리">
        <button type="button">옷장</button>
      </LobbyMenu>,
    );

    const trigger = screen.getByRole("button", { name: "내 카피바라 메뉴" });
    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("dialog", { name: "내 카피바라" })).toBeInTheDocument();
    expect(screen.getByText("보리")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
  });

  it("기존 기능 단축키로 메뉴도 연다", () => {
    render(<LobbyMenu name="">기능</LobbyMenu>);

    fireEvent.keyDown(window, { key: "i", code: "KeyI" });

    expect(screen.getByRole("button", { name: "내 카피바라 메뉴" })).toHaveAttribute("aria-expanded", "true");
  });

  it("닫힌 하위 패널을 건너뛰고 메뉴 안에서 Tab 포커스를 순환한다", () => {
    render(
      <LobbyMenu name="보리">
        <button type="button">옷장</button>
        <section inert>
          <button type="button">숨은 버튼</button>
        </section>
      </LobbyMenu>,
    );
    fireEvent.click(screen.getByRole("button", { name: "내 카피바라 메뉴" }));
    const closeButton = screen.getByRole("button", { name: "닫기" });
    const wardrobeButton = screen.getByRole("button", { name: "옷장" });

    wardrobeButton.focus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(wardrobeButton).toHaveFocus();
  });
});
