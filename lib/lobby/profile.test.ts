// @vitest-environment node
import { describe, expect, it } from "vitest";

import { parseLobbyProfile } from "./profile";

const ID = "3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const newId = () => "new-id";

describe("로비 프로필 저장값", () => {
  it("저장된 id·이름을 그대로 읽고, 이름은 정리한다", () => {
    expect(parseLobbyProfile(JSON.stringify({ id: ID, name: " 보리\n바라 " }), newId)).toEqual({ id: ID, name: "보리 바라" });
  });

  it("처음이거나 깨졌거나 id가 틀리면 새 id를 만들고 이름은 비운다", () => {
    expect(parseLobbyProfile(null, newId)).toEqual({ id: "new-id", name: "" });
    expect(parseLobbyProfile("{", newId)).toEqual({ id: "new-id", name: "" });
    expect(parseLobbyProfile(JSON.stringify({ id: "nope", name: 3 }), newId)).toEqual({ id: "new-id", name: "" });
  });
});
