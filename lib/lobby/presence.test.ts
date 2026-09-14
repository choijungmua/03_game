// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  ATTACK_COOLDOWN_MS,
  CHAT_COOLDOWN_MS,
  CHAT_MAX,
  CHAT_MS,
  cleanChat,
  graphemes,
  parsePresence,
  STALE_MS,
  STUN_MS,
  updatePresence,
  VIEW_RADIUS,
} from "./presence";

// 맵이 하나라 모든 플레이어가 한 공간에 있다. 테스트끼리 섞이지 않게 테스트마다 멀리 떨어진 곳을 쓴다
let area = 0;
let counter = 0;
function spot() {
  area += 1;
  return area * 100_000;
}
function player(x: number, y = 0) {
  return { token: `token-${counter++}-xxxxxxxxxxxxxxxx`, x, y, facing: "down" as const, sitting: false, attack: false, outfit: {} };
}

describe("로비 멀티", () => {
  it("가까운 플레이어끼리 서로 보이고, 토큰은 노출되지 않는다", () => {
    const base = spot();
    updatePresence(player(base), 1000);
    const result = updatePresence(player(base + 100), 1000);
    expect(result?.players).toHaveLength(1);
    expect(result?.players[0]).not.toHaveProperty("token");
  });

  it("먼 곳의 플레이어는 안 보인다", () => {
    const base = spot();
    updatePresence(player(base), 1000);
    expect(updatePresence(player(base + VIEW_RADIUS + 10), 1000)?.players).toHaveLength(0);
  });

  it("오래 소식이 없는 플레이어는 사라진다", () => {
    const base = spot();
    updatePresence(player(base), 1000);
    expect(updatePresence(player(base), 1000 + STALE_MS + 1)?.players).toHaveLength(0);
  });

  it("걸을 수 있는 거리보다 멀리 순간이동하면 보정된다", () => {
    const base = spot();
    const me = player(base);
    updatePresence(me, 50_000);
    const result = updatePresence({ ...me, x: base + 100_000 }, 50_100);
    expect(result?.you.x).toBeLessThan(base + 200);
  });

  it("바라보는 쪽 가까운 플레이어를 때리면 2초 기절하고, 그동안 못 움직인다", () => {
    const base = spot();
    const attacker = player(base, 0); // 아래(down)를 본다
    const victim = player(base, 40);
    updatePresence(attacker, 60_000);
    updatePresence(victim, 60_000);

    const punch = updatePresence({ ...attacker, attack: true }, 60_100);
    expect(punch?.hit).toBeTruthy();
    expect(punch?.you.attackMs).toBeGreaterThan(0);

    const stunned = updatePresence({ ...victim, y: 140 }, 60_200);
    expect(stunned?.you.stunMs).toBe(STUN_MS - 100);
    expect(stunned?.you.y).toBe(40); // 기절 중 이동 무시

    const recovered = updatePresence({ ...victim, y: 140 }, 60_100 + STUN_MS + 1);
    expect(recovered?.you.stunMs).toBe(0);
    expect(recovered?.you.y).toBe(140);
  });

  it("등 뒤·먼 곳은 안 맞고, 연타는 쿨타임이 있다", () => {
    const base = spot();
    const attacker = player(base, 0);
    updatePresence(attacker, 70_000);
    updatePresence(player(base, -40), 70_000); // 등 뒤
    expect(updatePresence({ ...attacker, attack: true }, 70_100)?.hit).toBeNull();

    updatePresence(player(base, 40), 70_100); // 앞
    expect(updatePresence({ ...attacker, attack: true }, 70_200)?.hit).toBeNull(); // 쿨타임
    expect(updatePresence({ ...attacker, attack: true }, 70_100 + ATTACK_COOLDOWN_MS)?.hit).toBeTruthy();
  });

  it("잘못된 요청은 거절한다", () => {
    expect(parsePresence(null)).toBeNull();
    expect(parsePresence({ ...player(0), x: Number.NaN })).toBeNull();
    expect(parsePresence({ ...player(0), token: "short" })).toBeNull();
    expect(parsePresence({ ...player(0), attack: undefined })?.attack).toBe(false);
    expect(parsePresence({ ...player(0), facing: "up-left" })?.facing).toBe("up-left");
  });

  it("입은 옷이 다른 플레이어에게 보이고, 모르는 옷·옷 없는 요청도 받아준다", () => {
    const base = spot();
    const dressed = parsePresence({ ...player(base), outfit: { hat: "crown", glasses: "nope" } });
    expect(dressed?.outfit).toEqual({ hat: "crown" });
    if (dressed) updatePresence(dressed, 90_000);
    expect(updatePresence(player(base + 50), 90_000)?.players[0].outfit).toEqual({ hat: "crown" });
    expect(parsePresence({ ...player(0), outfit: undefined })?.outfit).toEqual({});
  });

  it("채팅은 근처 플레이어에게 잠깐 보이고, 연달아 보내면 쿨타임 안의 것은 버려진다", () => {
    const base = spot();
    const talker = player(base);
    const listener = player(base + 50);
    updatePresence(talker, 100_000);
    updatePresence({ ...talker, chat: "안녕" }, 100_100);
    expect(updatePresence(listener, 100_200)?.players[0]).toMatchObject({ chat: "안녕", chatMs: CHAT_MS - 100 });

    updatePresence({ ...talker, chat: "도배" }, 100_200); // 쿨타임
    expect(updatePresence(listener, 100_300)?.players[0].chat).toBe("안녕");
    updatePresence({ ...talker, chat: "다시" }, 100_100 + CHAT_COOLDOWN_MS);
    expect(updatePresence(listener, 100_900)?.players[0].chat).toBe("다시");

    expect(updatePresence(listener, 100_100 + CHAT_COOLDOWN_MS + CHAT_MS)?.players[0]).toMatchObject({ chat: "", chatMs: 0 });
  });

  it("채팅은 줄바꿈·제어문자를 지우고 길이를 자르며, 빈 채팅은 없는 것으로 본다", () => {
    expect(cleanChat(`  안\n녕${String.fromCharCode(0)}하세요  `)).toBe("안 녕 하세요");
    expect([...cleanChat("가".repeat(CHAT_MAX + 10))]).toHaveLength(CHAT_MAX);
    expect(parsePresence({ ...player(0), chat: " \n " })).not.toHaveProperty("chat");
  });

  it("채팅 이모지는 조합을 지키고, 보이는 글자 단위로 자른다", () => {
    const family = "\u{1F468}\u200D\u{1F469}\u200D\u{1F467}";
    const thumb = "\u{1F44D}\u{1F3FD}";
    expect(cleanChat(`안녕 ${family}${thumb}`)).toBe(`안녕 ${family}${thumb}`);
    expect(graphemes(cleanChat(family.repeat(CHAT_MAX + 5)))).toHaveLength(CHAT_MAX);
  });

  it("대각선을 보고 때리면 그 대각선 앞쪽이 맞는다", () => {
    const base = spot();
    const attacker = { ...player(base, 0), facing: "down-right" as const };
    updatePresence(attacker, 80_000);
    updatePresence(player(base + 30, 30), 80_000);
    expect(updatePresence({ ...attacker, attack: true }, 80_100)?.hit).toBeTruthy();
  });

  // 최대 인원을 채우므로 맨 마지막에 둔다
  it("최대 인원이 동시에 들어와도 이름표가 겹치지 않는다", () => {
    const now = 10_000_000; // 앞선 테스트의 플레이어는 오래돼서 지워진다
    const names = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const name = updatePresence(player(spot()), now)?.you.name;
      expect(name).toMatch(/^\S+ \S+바라$/);
      if (name) names.add(name);
    }
    expect(names.size).toBe(500);
  });
});
