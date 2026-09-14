import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { GuestbookBoard } from "./guestbook-board";

const first = { id: 1, nickname: "카피", message: "첫 글", createdAt: "2026-09-15T01:00:00Z" };

describe("방명록", () => {
  it("최신 글을 보여 주고, 글을 남기면 백엔드에 보내고 맨 위에 붙인다", async () => {
    const fetch = vi.fn((_url: string, init?: RequestInit) =>
      Promise.resolve(
        init?.method === "POST"
          ? Response.json({ entry: { id: 2, nickname: "익명 카피바라", message: "안녕", createdAt: "2026-09-15T02:00:00Z" } }, { status: 201 })
          : Response.json({ entries: [first] }),
      ),
    );
    vi.stubGlobal("fetch", fetch);
    render(<GuestbookBoard />);

    expect(await screen.findByText("첫 글")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("남길 말"), { target: { value: "  안녕  " } });
    fireEvent.click(screen.getByRole("button", { name: "남기기" }));

    expect(await screen.findByText("안녕")).toBeInTheDocument();
    const [url, init] = fetch.mock.calls[1];
    expect(url).toMatch(/\/api\/guestbook$/);
    expect(JSON.parse(String(init?.body))).toMatchObject({ nickname: "", message: "안녕" });
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      expect.stringContaining("안녕"),
      expect.stringContaining("첫 글"),
    ]);
    expect(screen.getByLabelText("남길 말")).toHaveValue("");
  });

  it("빈 글은 보내지 않고 옆에 안내한다", async () => {
    const fetch = vi.fn(() => Promise.resolve(Response.json({ entries: [] })));
    vi.stubGlobal("fetch", fetch);
    render(<GuestbookBoard />);
    await screen.findByText("아직 글이 없어요. 첫 글을 남겨 주세요!");

    fireEvent.click(screen.getByRole("button", { name: "남기기" }));

    expect(screen.getByText("남길 말을 적어 주세요")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("목록을 못 불러오면 서버 문구와 다시 불러오기 버튼", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(Response.json({ error: "방명록을 지금 쓸 수 없어요" }, { status: 503 }))));
    render(<GuestbookBoard />);

    expect(await screen.findByText("방명록을 지금 쓸 수 없어요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 불러오기" })).toBeInTheDocument();
  });
});
