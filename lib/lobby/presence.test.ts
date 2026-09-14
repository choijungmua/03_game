// @vitest-environment node
import { describe, expect, it } from "vitest";

import { CHAT_MAX, cleanChat } from "./presence";

// 위치 보정·때리기·채팅 쿨타임 판정 테스트는 백엔드(04_game_b)로 옮겼다
describe("로비 채팅", () => {
  it("채팅은 줄바꿈·제어문자를 지우고 길이를 자른다", () => {
    expect(cleanChat(`  안\n녕${String.fromCharCode(0)}하세요  `)).toBe("안 녕 하세요");
    expect([...cleanChat("가".repeat(CHAT_MAX + 10))]).toHaveLength(CHAT_MAX);
    expect(cleanChat(" \n ")).toBe("");
  });
});
