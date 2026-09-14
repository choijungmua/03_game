import { describe, expect, it } from "vitest";

import { EFFECTS } from "./constants";
import { burst, createEffects, popup, shake, shakeOffset, updateEffects } from "./effects";

describe("비행기 슈팅 연출", () => {
  it("흔들림은 시간이 지나며 잦아들고, 끝나면 화면이 제자리다", () => {
    const effects = createEffects();
    shake(effects, 6, 200);
    expect(shakeOffset(effects, () => 1).x).toBeCloseTo(6);

    updateEffects(effects, 100);
    expect(shakeOffset(effects, () => 1).x).toBeCloseTo(3);

    updateEffects(effects, 100);
    expect(shakeOffset(effects, () => 1)).toEqual({ x: 0, y: 0 });
  });

  it("세게 흔들리는 중에는 약한 흔들림이 덮어쓰지 않는다", () => {
    const effects = createEffects();
    shake(effects, 10, 400);
    shake(effects, 2, 100);
    expect(shakeOffset(effects, () => 1).x).toBeCloseTo(10);
  });

  it("파편은 한도를 넘게 늘지 않고, 수명이 지나면 사라진다", () => {
    const effects = createEffects();
    burst(effects, 0, 0, EFFECTS.maxParticles + 50, ["text", "warning"], 100, () => 0.5);
    expect(effects.particles).toHaveLength(EFFECTS.maxParticles);

    updateEffects(effects, EFFECTS.particleLifeMs - 1);
    expect(effects.particles).toHaveLength(EFFECTS.maxParticles);

    updateEffects(effects, 1);
    expect(effects.particles).toHaveLength(0);
  });

  it("점수 글자는 popupMs 동안만 남는다", () => {
    const effects = createEffects();
    popup(effects, 10, 10, "+100", "text");

    updateEffects(effects, EFFECTS.popupMs - 1);
    expect(effects.popups).toHaveLength(1);

    updateEffects(effects, 1);
    expect(effects.popups).toHaveLength(0);
  });

  it("맞은 순간 멈춤·붉은 테두리·총구 불꽃은 시간이 지나면 0이 된다", () => {
    const effects = createEffects();
    effects.hitStopMs = EFFECTS.hitStopMs;
    effects.damageFlashMs = EFFECTS.damageFlashMs;
    effects.muzzleMs = EFFECTS.muzzleMs;

    updateEffects(effects, EFFECTS.damageFlashMs);
    expect(effects).toMatchObject({ hitStopMs: 0, damageFlashMs: 0, muzzleMs: 0 });
  });
});
