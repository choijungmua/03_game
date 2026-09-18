import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LobbyMenu, useLobbyMenuPanel } from "./lobby-menu";

function OpenProbe() {
  const { open } = useLobbyMenuPanel("fish");
  return <p>{open ? "가방 보임" : "가방 숨김"}</p>;
}

const panels = {
  wardrobe: <button type="button">밀짚모자</button>,
  fish: <OpenProbe />,
  sound: <p>소리 패널</p>,
  profile: <p>이름 패널</p>,
};

describe("로비 메뉴", () => {
  it("하나의 진입점으로 열리고 선택된 탭에 포커스가 가며 Escape로 닫힌다", () => {
    render(<LobbyMenu name="보리" panels={panels} />);

    const trigger = screen.getByRole("button", { name: "내 카피바라 메뉴" });
    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("dialog", { name: "내 카피바라" })).toBeInTheDocument();
    expect(screen.getByText("보리")).toBeInTheDocument();
    // 처음 열면 빈 화면 없이 옷장 탭이 보인다
    const wardrobeTab = screen.getByRole("tab", { name: "카피바라 옷 입히기" });
    expect(wardrobeTab).toHaveAttribute("aria-selected", "true");
    expect(wardrobeTab).toHaveFocus();
    expect(screen.getByRole("tabpanel", { name: "카피바라 옷 입히기" })).toBeVisible();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
  });

  it("방향키·Home·End로 탭을 옮기고 그 패널만 보인다", () => {
    render(<LobbyMenu name="보리" panels={panels} />);
    fireEvent.click(screen.getByRole("button", { name: "내 카피바라 메뉴" }));
    const tablist = screen.getByRole("tablist");
    const selected = (name: string) => expect(screen.getByRole("tab", { name })).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(tablist, { key: "ArrowRight" });
    selected("낚시 가방");
    expect(screen.getByRole("tab", { name: "낚시 가방" })).toHaveFocus();
    expect(screen.getByText("가방 보임")).toBeVisible();
    expect(screen.queryByRole("tabpanel", { name: "카피바라 옷 입히기" })).toBeNull();

    fireEvent.keyDown(tablist, { key: "End" });
    selected("이름 바꾸기");
    fireEvent.keyDown(tablist, { key: "ArrowRight" });
    selected("카피바라 옷 입히기");
    fireEvent.keyDown(tablist, { key: "ArrowLeft" });
    selected("이름 바꾸기");
    fireEvent.keyDown(tablist, { key: "Home" });
    selected("카피바라 옷 입히기");
  });

  it("단축키는 그 탭을 열고, 같은 키를 한 번 더 누르면 닫는다", () => {
    render(<LobbyMenu name="" panels={panels} />);
    const trigger = screen.getByRole("button", { name: "내 카피바라 메뉴" });

    fireEvent.keyDown(window, { key: "i", code: "KeyI" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("tab", { name: "낚시 가방" })).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(window, { key: "p", code: "KeyP" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("tab", { name: "카피바라 옷 입히기" })).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(window, { key: "p", code: "KeyP" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("숨은 패널과 선택 안 된 탭을 건너뛰고 메뉴 안에서 Tab 포커스를 순환한다", () => {
    render(<LobbyMenu name="보리" panels={panels} />);
    fireEvent.click(screen.getByRole("button", { name: "내 카피바라 메뉴" }));
    const dialog = screen.getByRole("dialog", { name: "내 카피바라" });
    const closeButton = screen.getByRole("button", { name: "닫기" });
    const hat = screen.getByRole("button", { name: "밀짚모자" });
    // 순서: 닫기 → 보이는 패널 → 맨 아래 탭 줄(선택된 탭 하나). 숨은 패널·선택 안 된 탭은 건너뛴다
    const wardrobeTab = screen.getByRole("tab", { name: "카피바라 옷 입히기" });

    // 맨 끝(탭 줄)에서 Tab을 누르면 처음(닫기)으로, 처음에서 Shift+Tab이면 다시 맨 끝으로 돈다
    wardrobeTab.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(wardrobeTab).toHaveFocus();

    // 가운데 컨트롤(옷 고르기)은 가두기가 끼어들지 않고 브라우저 기본 이동에 맡긴다
    hat.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(hat).toHaveFocus();
  });
});
