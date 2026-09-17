// @vitest-environment node
import { describe, expect, it } from "vitest";

import { parseLobbyProfile } from "./profile";

const ID = "3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const TOKEN = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
const ids = [ID, TOKEN];
const newId = () => ids.shift() ?? TOKEN;

describe("로비 프로필 저장값", () => {
  it("저장된 id·이름을 그대로 읽고, 이름은 정리한다", () => {
    expect(parseLobbyProfile(JSON.stringify({ id: ID, token: TOKEN, name: " 보리\n바라 " }), newId)).toEqual({
      id: ID,
      token: TOKEN,
      name: "보리 바라",
    });
  });

  it("처음이거나 id·토큰이 틀리면 새 자격 증명을 함께 만들고 이름은 비운다", () => {
    const generated = [ID, TOKEN];
    const generate = () => generated.shift() ?? TOKEN;
    expect(parseLobbyProfile(null, generate)).toEqual({ id: ID, token: TOKEN, name: "" });

    const replaced = [ID, TOKEN];
    expect(parseLobbyProfile(JSON.stringify({ id: ID, token: "nope", name: "보리" }), () => replaced.shift() ?? TOKEN)).toEqual({
      id: ID,
      token: TOKEN,
      name: "",
    });
  });
});
