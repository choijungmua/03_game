import { describe, expect, it } from "vitest";

import { DEFAULT_LOBBY_SETTINGS } from "./constants";
import { toggledSound, withVolume } from "./settings";

const base = DEFAULT_LOBBY_SETTINGS;

describe("효과음 켜고 끄기 규칙 (로비 헤드폰·M·게임 화면 효과음 버튼·음량 슬라이더 공통)", () => {
  it("음량이 0으로 저장돼 있으면 켤 때 기본 음량으로 켜진다 — 켜도 들리지 않아 다시 켤 수 없던 문제", () => {
    expect(toggledSound({ ...base, muted: false, volume: 0 })).toMatchObject({ muted: false, volume: base.volume });
    expect(toggledSound({ ...base, muted: true, volume: 0 })).toMatchObject({ muted: false, volume: base.volume });
  });

  it("켜진 상태에서 누르면 음량은 그대로 두고 끈다", () => {
    expect(toggledSound({ ...base, muted: false, volume: 0.3 })).toMatchObject({ muted: true, volume: 0.3 });
  });

  it("슬라이더를 0으로 내리면 끄되 직전 음량을 남겨, 다시 켜면 그 음량으로 켜진다", () => {
    const off = withVolume({ ...base, muted: false, volume: 0.3 }, 0);
    expect(off).toMatchObject({ muted: true, volume: 0.3 });
    expect(toggledSound(off)).toMatchObject({ muted: false, volume: 0.3 });
  });

  it("음소거 중에 슬라이더를 올리면 켜진다", () => {
    expect(withVolume({ ...base, muted: true, volume: 0.3 }, 0.5)).toMatchObject({ muted: false, volume: 0.5 });
  });
});
