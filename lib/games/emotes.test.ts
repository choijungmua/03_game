import { describe, expect, it } from "vitest";

import { cleanChat } from "../lobby/presence";
import { emoteChat, parseEmoteChat } from "./emotes";

describe("로비 채팅 이모티콘", () => {
  it("이모티콘 채팅은 채팅 정리를 거쳐도 번호로 돌아오고, 섞이거나 없는 번호는 글자로 본다", () => {
    expect(parseEmoteChat(cleanChat(emoteChat(15)))).toBe(15);
    expect(parseEmoteChat(emoteChat(16))).toBeNull();
    expect(parseEmoteChat(`${emoteChat(1)} 안녕`)).toBeNull();
    expect(parseEmoteChat("안녕")).toBeNull();
  });
});
