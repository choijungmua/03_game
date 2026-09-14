import { afterEach, describe, expect, it, vi } from "vitest";

import { GAME_SOUNDS } from "@/lib/games/constants";

import { playGameSound } from "./settings";

/** 만들 수는 있지만 소리를 만들려 하면 예외를 던지는 오디오 (iOS에서 오디오가 끊긴 상태·잘못된 값 등) */
class BrokenAudioContext {
  state = "running";
  currentTime = 0;
  sampleRate = 8000;
  createBuffer() {
    throw new Error("오디오 장치가 멈췄어요");
  }
}

describe("playGameSound", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("Web Audio가 예외를 던져도 게임 코드(샷 애니메이션·이모티콘 효과음)로 번지지 않는다", () => {
    vi.stubGlobal("AudioContext", BrokenAudioContext);
    expect(() => playGameSound(GAME_SOUNDS.tap)).not.toThrow();
  });
});
