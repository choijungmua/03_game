import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LobbyLink } from "./lobby-link";
import { cameFromLobby, markLobbyExit } from "./lobby-return";

describe("LobbyLink", () => {
  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
    window.history.replaceState(null, "", "/");
  });

  it("로비에서 바로 들어온 게임이면 새 기록(로비)을 쌓지 않고 뒤로 간다 — 로비에서 뒤로 가기가 게임으로 돌아가지 않게", () => {
    window.history.replaceState(null, "", "/games/click-speed");
    markLobbyExit("/games/click-speed");
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});

    render(<LobbyLink>로비로</LobbyLink>);
    const followed = fireEvent.click(screen.getByRole("link", { name: "로비로" }));

    expect(followed).toBe(false);
    expect(back).toHaveBeenCalledTimes(1);
  });

  it("초대 링크·주소 입력으로 바로 들어왔으면(앞 기록이 로비가 아님) 로비(/) 링크 그대로다", () => {
    window.history.replaceState(null, "", "/games/click-speed");
    markLobbyExit("/games/reaction-time");

    render(<LobbyLink>로비로</LobbyLink>);
    expect(cameFromLobby()).toBe(false);
    expect(screen.getByRole("link", { name: "로비로" })).toHaveAttribute("href", "/");
  });
});
