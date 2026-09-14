import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GAMES } from "@/lib/games/registry";

import ListPage, { metadata } from "./page";

describe("/list 관리자 게임 목록", () => {
  it("등록된 게임을 이름 한 줄씩 게임 링크로 보여준다", () => {
    render(<ListPage />);
    const links = screen.getAllByRole("link");

    expect(links).toHaveLength(GAMES.length);
    GAMES.forEach((game, index) => {
      expect(links[index].textContent).toBe(game.title);
      expect(links[index]).toHaveAttribute("href", `/games/${game.slug}`);
    });
  });

  it("게임 설명은 보여주지 않는다", () => {
    render(<ListPage />);
    GAMES.forEach((game) => {
      expect(screen.queryByText(game.description)).toBeNull();
    });
  });

  it("검색엔진에 노출되지 않는다", () => {
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
  });
});
