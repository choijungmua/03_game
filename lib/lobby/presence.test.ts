// @vitest-environment node
import { describe, expect, it } from "vitest";

import { NAME_MAX } from "./constants";
import { CHAT_MAX, cleanChat, cleanName, graphemes } from "./presence";

// 위치 보정·때리기·채팅 쿨타임·이름표 판정 테스트는 백엔드(04_game_b)로 옮겼다
describe("로비 채팅", () => {
  it("채팅은 줄바꿈·제어문자를 지우고 길이를 자른다", () => {
    expect(cleanChat(`  안\n녕${String.fromCharCode(0)}하세요  `)).toBe("안 녕 하세요");
    expect([...cleanChat("가".repeat(CHAT_MAX + 10))]).toHaveLength(CHAT_MAX);
    expect(cleanChat(" \n ")).toBe("");
  });

  it("채팅 이모지는 조합을 지키고, 보이는 글자 단위로 자른다", () => {
    const family = "\u{1F468}‍\u{1F469}‍\u{1F467}";
    const thumb = "\u{1F44D}\u{1F3FD}";
    expect(cleanChat(`안녕 ${family}${thumb}`)).toBe(`안녕 ${family}${thumb}`);
    expect(graphemes(cleanChat(family.repeat(CHAT_MAX + 5)))).toHaveLength(CHAT_MAX);
  });

  it("이름표는 줄바꿈·[[ ]]를 지우고 NAME_MAX 글자로 자른다", () => {
    expect(cleanName(" 보리\n바라 ")).toBe("보리 바라");
    expect(cleanName("[[emote:1]]")).toBe("emote:1");
    expect(cleanName(" [] ")).toBe("");
    expect(graphemes(cleanName("가".repeat(NAME_MAX + 5)))).toHaveLength(NAME_MAX);
  });
});
