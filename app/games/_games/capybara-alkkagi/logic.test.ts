// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { Stone } from "@/lib/games/rooms";

import { type AlkkagiState, createGame, FIELD, MAX_SPEED, type Piece, shoot, simulateShot, timeOut } from "./logic";
import { alkkagiRooms } from "./rooms";

function piece(id: number, owner: Stone, x: number, y: number, leader = false): Piece {
  return { id, owner, x, y, out: false, leader };
}

function withPieces(pieces: Piece[]): AlkkagiState {
  return { ...createGame(), pieces };
}

function fire(state: AlkkagiState, pieceId: number, x: number, y: number, seat: Stone = "black") {
  const result = shoot(state, pieceId, { x, y }, seat);
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

describe("simulateShot", () => {
  it("정면으로 맞히면 친 알은 거의 서고 맞은 알이 밀려난다", () => {
    const [shooter, target] = simulateShot([piece(0, "black", 500, 800), piece(1, "white", 500, 600)], 0, { x: 0, y: -10 });
    expect(target.y).toBeLessThan(500);
    expect(shooter.y).toBeGreaterThan(target.y + 150);
  });

  it("대장은 무거워서 같은 힘에 덜 밀린다", () => {
    const shot = { x: 0, y: -12 };
    const [, normal] = simulateShot([piece(0, "black", 500, 800), piece(1, "white", 500, 600)], 0, shot);
    const [, leader] = simulateShot([piece(0, "black", 500, 800), piece(1, "white", 500, 600, true)], 0, shot);
    expect(600 - leader.y).toBeLessThan((600 - normal.y) * 0.85);
  });

  it("최대 힘이어도 혼자서는 판 한 변을 다 못 간다", () => {
    const [alone] = simulateShot([piece(0, "black", 500, 999)], 0, { x: 0, y: -MAX_SPEED });
    expect(alone.out).toBe(false);
    expect(999 - alone.y).toBeLessThan(FIELD * 0.7);
  });

  it("처음 자리에서 최대 힘으로 정면을 맞혀도 상대 알이 한 번에 떨어지지 않는다", () => {
    const after = simulateShot(createGame().pieces, 1, { x: 0, y: -MAX_SPEED });
    expect(after.filter((p) => p.out)).toEqual([]);
  });

  it("아주 빠르게 부딪혀도 알이 서로 뚫고 지나가지 않는다", () => {
    let passedThrough = false;
    simulateShot([piece(0, "black", 500, 300), piece(1, "white", 500, 180)], 0, { x: 0, y: -MAX_SPEED }, (pieces) => {
      if (pieces[0].y < pieces[1].y) passedThrough = true;
    });
    expect(passedThrough).toBe(false);
  });

  it("같은 샷은 항상 같은 결과다", () => {
    const pieces = createGame().pieces;
    expect(simulateShot(pieces, 2, { x: 3, y: -20 })).toEqual(simulateShot(pieces, 2, { x: 3, y: -20 }));
  });
});

describe("shoot", () => {
  it("가까이서 세게 맞혀 상대 알을 떨어뜨리고 내 알이 남으면 한 번 더 친다", () => {
    const next = fire(withPieces([piece(0, "black", 500, 400), piece(1, "white", 500, 250), piece(2, "white", 100, 100)]), 0, 0, -MAX_SPEED);
    expect(next.pieces.find((p) => p.id === 1)?.out).toBe(true);
    expect(next).toMatchObject({ turn: "black", combo: 1, winner: null, lastShot: { seq: 1, knocked: 1 } });
  });

  it("아무것도 못 떨어뜨리면 차례가 넘어간다", () => {
    const next = fire(withPieces([piece(0, "black", 500, 800), piece(1, "white", 100, 100)]), 0, 3, 0);
    expect(next).toMatchObject({ turn: "white", combo: 0 });
  });

  it("상대 알이 다 떨어지면 이기고, 내 알이 다 떨어지면 진다", () => {
    expect(fire(withPieces([piece(0, "black", 500, 400), piece(1, "white", 500, 250)]), 0, 0, -MAX_SPEED).winner).toBe("black");
    expect(fire(withPieces([piece(0, "black", 60, 800), piece(1, "white", 900, 100)]), 0, -MAX_SPEED, 0).winner).toBe("white");
  });

  it("대장 카피바라는 한쪽에 한 마리씩 있다", () => {
    const leaders = createGame().pieces.filter((p) => p.leader);
    expect(leaders.map((p) => p.owner).sort()).toEqual(["black", "white"]);
  });

  it("대장이 떨어져도 다른 알이 남아 있으면 지지 않는다", () => {
    const next = fire(
      withPieces([piece(0, "black", 500, 400), piece(1, "white", 500, 250, true), piece(2, "white", 100, 100)]),
      0,
      0,
      -MAX_SPEED,
    );
    expect(next.pieces.find((p) => p.id === 1)?.out).toBe(true);
    expect(next).toMatchObject({ winner: null, endReason: null });
  });

  it("내 차례에 판 위의 내 알만 칠 수 있고, 너무 센 힘은 최대치로 줄인다", () => {
    const state = createGame();
    expect(shoot(state, 5, { x: 0, y: 10 }, "black").ok).toBe(false);
    expect(shoot(state, 0, { x: 0, y: -10 }, "white").ok).toBe(false);
    expect(fire(state, 0, 0, -1000).lastShot?.velocity).toEqual({ x: 0, y: -MAX_SPEED });
  });

  it("제한시간을 넘기면 그 차례인 쪽이 진다", () => {
    expect(timeOut(createGame(), "black")).toMatchObject({ winner: "white", endReason: "timeout" });
  });
});

describe("알까기 방", () => {
  it("방향(aim)이 서버까지 전달된다", () => {
    const created = alkkagiRooms.createRoom();
    if (!created.ok || !created.token) throw new Error("방 생성 실패");
    alkkagiRooms.actOnRoom(created.view.code, { type: "join" });
    expect(alkkagiRooms.actOnRoom(created.view.code, { type: "shoot", token: created.token, index: 0 })).toMatchObject({ ok: false, status: 409 });
    expect(
      alkkagiRooms.actOnRoom(created.view.code, { type: "shoot", token: created.token, index: 0, aim: { x: 0, y: -20 } }),
    ).toMatchObject({ ok: true, view: { state: { lastShot: { seq: 1 } } } });
  });
});
