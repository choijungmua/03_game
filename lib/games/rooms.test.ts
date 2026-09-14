// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import { TURN_TIME_MS } from "@/app/games/_games/capybara-baduk/logic";
import { badukRooms } from "@/app/games/_games/capybara-baduk/rooms";
import { gomokuRooms } from "@/app/games/_games/capybara-gomoku/rooms";

const { actOnRoom, createRoom, readRoom } = badukRooms;

function open() {
  const created = createRoom();
  if (!created.ok || !created.token) throw new Error("방 생성 실패");
  const joined = actOnRoom(created.view.code, { type: "join" });
  if (!joined.ok || !joined.token) throw new Error("참가 실패");
  return { code: created.view.code, black: created.token, white: joined.token };
}

describe("초대 코드 방", () => {
  it("만든 사람이 흑, 코드로 들어온 사람이 백이다", () => {
    const { code, black, white } = open();
    expect(code).toMatch(/^[A-Z2-9]{6}$/);
    expect(readRoom(code.toLowerCase(), black)).toMatchObject({ ok: true, view: { you: "black" } });
    expect(readRoom(code, white)).toMatchObject({ ok: true, view: { you: "white", joined: { black: true, white: true } } });
  });

  it("세 번째 사람은 못 들어오지만, 원래 대국자는 토큰으로 다시 들어온다", () => {
    const { code, white } = open();
    expect(actOnRoom(code, { type: "join" })).toMatchObject({ ok: false, status: 409 });
    expect(actOnRoom(code, { type: "join", token: white })).toMatchObject({ ok: true, token: white });
  });

  it("차례와 자리를 서버에서 검사한다", () => {
    const { code, black, white } = open();
    expect(actOnRoom(code, { type: "move", token: white, index: 0 })).toMatchObject({ ok: false, status: 409 });
    expect(actOnRoom(code, { type: "move", token: "남의-토큰", index: 0 })).toMatchObject({ ok: false, status: 403 });
    expect(actOnRoom(code, { type: "move", token: black, index: 0 })).toMatchObject({ ok: true });
    expect(readRoom(code, null)).toMatchObject({ ok: true, view: { you: null, state: { turn: "white" } } });
  });

  it("그 게임에 없는 행동은 400", () => {
    const created = gomokuRooms.createRoom();
    if (!created.ok || !created.token) throw new Error("방 생성 실패");
    expect(gomokuRooms.actOnRoom(created.view.code, { type: "pass", token: created.token })).toMatchObject({ ok: false, status: 400 });
  });

  it("게임마다 방이 따로다", () => {
    const { code } = open();
    expect(gomokuRooms.readRoom(code, null)).toMatchObject({ ok: false, status: 404 });
  });

  it("이모티콘은 차례와 상관없이 대국자만, 있는 번호만 보낸다", () => {
    const { code, black, white } = open();
    expect(actOnRoom(code, { type: "emote", token: white, index: 15 })).toMatchObject({
      ok: true,
      view: { emote: { seat: "white", id: 15 }, state: { turn: "black" } },
    });
    expect(actOnRoom(code, { type: "emote", token: white, index: 16 })).toMatchObject({ ok: false, status: 400 });
    // 앞 이모티콘이 떠 있는 동안(5초)은 누구도 새로 못 보낸다
    expect(actOnRoom(code, { type: "emote", token: black, index: 0 })).toMatchObject({ ok: false, status: 409 });
    expect(actOnRoom(code, { type: "emote", index: 0 })).toMatchObject({ ok: false, status: 403 });
  });

  it("방 목록에는 상대를 기다리고 만든 사람이 아직 있는 방만 나온다", () => {
    vi.useFakeTimers();
    const waiting = createRoom();
    if (!waiting.ok || !waiting.token) throw new Error("방 생성 실패");
    const { code: full } = open();
    const listed = () => badukRooms.listRooms().map((room) => room.code);

    expect(listed()).toContain(waiting.view.code);
    expect(listed()).not.toContain(full);

    // 만든 사람이 폴링하면 남고, 5초 넘게 소식이 없으면 빠진다
    vi.advanceTimersByTime(4000);
    readRoom(waiting.view.code, waiting.token);
    vi.advanceTimersByTime(4000);
    expect(listed()).toContain(waiting.view.code);
    vi.advanceTimersByTime(2000);
    expect(listed()).not.toContain(waiting.view.code);
    vi.useRealTimers();
  });

  it("없는 코드는 404", () => {
    expect(readRoom("ZZZZZZ", null)).toMatchObject({ ok: false, status: 404 });
  });
});

describe("한 수 제한시간", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("상대가 들어오기 전에는 시간이 흐르지 않는다", () => {
    const created = createRoom();
    expect(created).toMatchObject({ ok: true, view: { state: { turnStartedAt: null } } });
  });

  it("제한시간(+1초 여유)을 넘기면 그 차례인 사람이 시간패로 진다", () => {
    vi.useFakeTimers();
    const { code } = open();

    vi.advanceTimersByTime(TURN_TIME_MS + 999);
    expect(readRoom(code, null)).toMatchObject({ ok: true, view: { state: { endReason: null } } });

    vi.advanceTimersByTime(2000);
    expect(readRoom(code, null)).toMatchObject({
      ok: true,
      view: { state: { winner: "white", endReason: "timeout", turnStartedAt: null } },
    });
  });

  it("수를 두면 상대 차례 시간이 새로 시작된다", () => {
    vi.useFakeTimers();
    const { code, black } = open();

    vi.advanceTimersByTime(TURN_TIME_MS - 1000);
    expect(actOnRoom(code, { type: "move", token: black, index: 40 })).toMatchObject({ ok: true });

    vi.advanceTimersByTime(TURN_TIME_MS - 1000);
    expect(readRoom(code, null)).toMatchObject({ ok: true, view: { state: { turn: "white", endReason: null } } });
  });
});
