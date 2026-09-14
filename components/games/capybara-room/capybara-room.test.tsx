import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createGame, type GomokuState } from "@/app/games/_games/capybara-gomoku/logic";
import { GAME_TITLES } from "@/lib/games/constants";
import type { RoomView, Stone } from "@/lib/games/rooms";

import { CapybaraRoom } from "./capybara-room";
import type { CapybaraRoomProps } from "./type";

const STONE_NAME: Record<Stone, string> = { black: "갈색 카피바라", white: "흰 카피바라" };

function renderRoom(view: RoomView<GomokuState>, sendEmote = vi.fn()) {
  const onPlay = vi.fn();
  const room: CapybaraRoomProps<GomokuState>["room"] = {
    slug: "capybara-gomoku",
    view,
    error: "",
    pending: false,
    copied: false,
    clockOffset: 0,
    create: vi.fn(),
    join: vi.fn(),
    sendEmote,
    copyInvite: vi.fn(),
    leave: vi.fn(),
    setError: vi.fn(),
  };
  render(
    <CapybaraRoom
      title={GAME_TITLES["capybara-gomoku"]}
      guide=""
      room={room}
      starPoints={[]}
      turnTimeMs={30_000}
      stoneName={STONE_NAME}
      onPlay={onPlay}
      onResign={vi.fn()}
      resultText=""
      adPlacement="test"
    />,
  );
  return onPlay;
}

function viewAs(you: Stone | null): RoomView<GomokuState> {
  // 흑 차례 판 — 백 화면 입장에서는 "상대 차례"로 알고 있는 상태
  return { code: "ABCDEF", state: createGame(), joined: { black: true, white: true }, you, now: Date.now(), version: 1, emote: null };
}

describe("놀리기 이모티콘", () => {
  it("한 페이지에 8개, 다음을 누르면 8번부터 보이고 누르면 그 번호를 보낸다", () => {
    const sendEmote = vi.fn();
    renderRoom(viewAs("white"), sendEmote);
    fireEvent.click(screen.getByRole("button", { name: "놀리기" }));
    expect(screen.getByRole("button", { name: "ㅋㅋㅋㅋㅋ" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "빠이빠이~" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    fireEvent.click(screen.getByRole("button", { name: "빠이빠이~" }));
    expect(sendEmote).toHaveBeenCalledWith(8);
  });

  it("상대가 보낸 이모티콘이 판 위에 뜬다", () => {
    renderRoom({ ...viewAs("white"), emote: { seat: "black", id: 1, at: 1 } });
    expect(screen.getByText("메롱~")).toBeInTheDocument();
    // 떠 있는 동안에는 새로 못 보낸다
    expect(screen.getByRole("button", { name: "놀리기" })).toBeDisabled();
  });
});

describe("CapybaraRoom 판", () => {
  it("화면이 상대 차례로 알고 있어도 빈 칸은 눌린다 (눌렀을 때 서버 기준으로 다시 확인)", () => {
    const onPlay = renderRoom(viewAs("white"));
    const cell = screen.getByRole("button", { name: "1행 1열 빈 자리" });
    expect(cell).toBeEnabled();
    fireEvent.click(cell);
    expect(onPlay).toHaveBeenCalledWith(0);
  });

  it("관전자는 판을 누를 수 없다", () => {
    renderRoom(viewAs(null));
    expect(screen.getByRole("button", { name: "1행 1열 빈 자리" })).toBeDisabled();
  });
});

describe("CapybaraRoom 뒤로 버튼", () => {
  it("대국 중에는 나가기 전에 확인 창을 띄운다", () => {
    renderRoom(viewAs("white"));
    fireEvent.click(screen.getByRole("button", { name: "로비로 돌아가기" }));
    expect(screen.getByText("나가면 상대가 기다리게 돼요")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "나가기" })).toHaveAttribute("href", "/");
  });

  it("관전자는 확인 없이 바로 로비로 간다", () => {
    renderRoom(viewAs(null));
    expect(screen.getByRole("link", { name: "로비로 돌아가기" })).toHaveAttribute("href", "/");
  });

  it("상대를 기다리는 중에는 확인 없이 바로 로비로 간다", () => {
    renderRoom({ ...viewAs("black"), joined: { black: true, white: false } });
    expect(screen.getByRole("link", { name: "로비로 돌아가기" })).toHaveAttribute("href", "/");
  });
});
