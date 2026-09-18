// @vitest-environment node
import { describe, expect, it } from "vitest";

import { parseLobbyProfile } from "./profile";

const ID = "3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const TOKEN = "9a8b7c6d-5e4f-4a3b-2c1d-0e9f8a7b6c5d";
const newId = () => "new-id";

describe("로비 프로필 저장값", () => {
  it("저장된 id·이름을 그대로 읽고, 이름은 정리한다", () => {
    expect(parseLobbyProfile(JSON.stringify({ id: ID, token: TOKEN, name: " 보리\n바라 " }), newId)).toEqual({ id: ID, token: TOKEN, name: "보리 바라" });
  });

  it("처음이거나 깨졌거나 id가 틀리면 새 id를 만들고 이름은 비운다", () => {
    expect(parseLobbyProfile(null, newId)).toEqual({ id: "new-id", token: "new-id", name: "" });
    expect(parseLobbyProfile("{", newId)).toEqual({ id: "new-id", token: "new-id", name: "" });
    expect(parseLobbyProfile(JSON.stringify({ id: "nope", name: 3 }), newId)).toEqual({ id: "new-id", token: "new-id", name: "" });
    // 토큰이 없던 기기(서버 가방 이전)는 id도 새로 받는다 — 남의 가방을 물려받지 않게
    expect(parseLobbyProfile(JSON.stringify({ id: ID, name: "보리" }), newId)).toEqual({ id: "new-id", token: "new-id", name: "" });
  });
});
