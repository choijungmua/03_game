import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getGame } from "@/lib/games/registry";

import { CapybaraDefense } from "./capybara-defense";
import { createEmptyInventory, createEmptyLoadout } from "./equipment";
import { createHeroInventory, drawHero } from "./heroes";
import { writeDefenseSave } from "./persistence";
import { createPlacementState, PLACEMENT_ZONES } from "./placement";
import { getClassAttackPresentation, getClassEffectFrame, getMonsterRenderPoint, renderDefenseFrame, validateUnitPlacement } from "./renderer";

beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null);
  window.localStorage.clear();
  window.history.replaceState({}, "", "/games/capybara-defense");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("카피바라 디펜스 통합 화면", () => {
  it("Given 고정 RNG When 새 게임과 결과 재도전을 시작하면 Then RNG가 고른 지도로 준비한다", async () => {
    const random = vi.fn().mockReturnValueOnce(0.99).mockReturnValueOnce(0);
    const user = userEvent.setup();
    window.history.replaceState({}, "", "/games/capybara-defense?defenseFixture=result");

    render(<CapybaraDefense random={random} />);

    expect(await screen.findByRole("application", { name: "카피바라 디펜스 전장" })).toBeInTheDocument();
    expect(screen.getByLabelText("달빛 과수원 전장 화면")).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "다시 도전" }));
    expect(screen.getByLabelText("갈대 습지 전장 화면")).toBeInTheDocument();
  });

  it("Given 게임 화면 When 처음 렌더링하면 Then 지도 선택이나 시작 대기 없이 준비 단계다", async () => {
    const { container } = render(<CapybaraDefense random={() => 0} />);

    expect(await screen.findByRole("application", { name: "카피바라 디펜스 전장" })).toBeInTheDocument();
    expect(container.querySelector("[data-phase='preparation']")).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "시작 지도" })).toBeNull();
    expect(screen.queryByRole("button", { name: "선택한 지도에서 시작" })).toBeNull();
  });

  it("Given 사각 순환 경로 When 모서리와 끝점을 투영하면 Then 네 모서리를 지나 출발점으로 닫힌다", () => {
    expect(getMonsterRenderPoint("reed-marsh", 0)).toEqual([3 / 16, 3 / 16]);
    expect(getMonsterRenderPoint("reed-marsh", 0.25)).toEqual([13 / 16, 3 / 16]);
    expect(getMonsterRenderPoint("reed-marsh", 0.5)).toEqual([13 / 16, 13 / 16]);
    expect(getMonsterRenderPoint("reed-marsh", 0.75)).toEqual([3 / 16, 13 / 16]);
    expect(getMonsterRenderPoint("reed-marsh", 1)).toEqual(getMonsterRenderPoint("reed-marsh", 0));
  });

  it("Given 세 화면 크기 공통 전장 When 화면을 열면 Then 한 화면 레이아웃과 통합 HUD를 사용한다", async () => {
    const { container } = render(<CapybaraDefense random={() => 0} />);

    await screen.findByRole("application", { name: "카피바라 디펜스 전장" });
    expect(container.querySelector("[data-viewport-fit='true']")).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "전투 현황" })).toHaveAttribute("data-hud", "strip");
    expect(container.querySelectorAll("[data-hud-card]")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "수비대 관리 열기" })).toBeInTheDocument();
  });

  it("Given 모션 감소 설정 When 전장을 열면 Then 모든 게임 피드백 모션을 정적으로 대체한다", async () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    const { container } = render(<CapybaraDefense random={() => 0} />);

    await screen.findByRole("application", { name: "카피바라 디펜스 전장" });
    expect(container.querySelector("[data-reduced-motion='true']")).toBeInTheDocument();
    expect(container.querySelectorAll("[data-motion='draw'], [data-motion='place'], [data-motion='attack'], [data-motion='monster'], [data-motion='round']")).toHaveLength(5);
  });

  it("Given 자유 배치 좌표 When 경로·겹침·경기장 밖을 검사하면 Then 구체적인 한국어 사유를 반환한다", () => {
    expect(validateUnitPlacement({ x: 0.5, y: 0.5 }, [])).toEqual({ kind: "valid" });
    expect(validateUnitPlacement({ x: 0.5, y: 3 / 16 }, [])).toMatchObject({ kind: "invalid", reason: expect.stringContaining("길") });
    expect(validateUnitPlacement({ x: 1.1, y: 0.5 }, [])).toMatchObject({ kind: "invalid", reason: expect.stringContaining("밖") });
    expect(validateUnitPlacement({ x: 0.5, y: 0.5 }, [{ x: 0.51, y: 0.51 }])).toMatchObject({ kind: "invalid", reason: expect.stringContaining("겹") });
  });

  it("Given 뽑은 영웅 When 포인터로 경기장에 끌어 놓으면 Then 포인터 캡처·고스트·자유 배치를 완료한다", async () => {
    const user = userEvent.setup();
    render(<CapybaraDefense random={() => 0} />);
    await user.click(screen.getByRole("button", { name: /영웅 뽑기/ }));
    const hero = screen.getByRole("button", { name: /전사 영웅 끌기 또는 선택/ });
    const canvas = screen.getByLabelText("갈대 습지 전장 화면");
    const capture = vi.fn();
    Object.defineProperty(hero, "setPointerCapture", { configurable: true, value: capture });
    Object.defineProperty(canvas, "getBoundingClientRect", { configurable: true, value: () => ({ x: 0, y: 0, left: 0, top: 0, right: 400, bottom: 400, width: 400, height: 400, toJSON: () => ({}) }) });

    fireEvent.pointerDown(hero, { pointerId: 7, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(hero, { pointerId: 7, clientX: 200, clientY: 200 });
    expect(document.querySelector("[data-valid='true']")).toBeInTheDocument();
    fireEvent.pointerUp(hero, { pointerId: 7, clientX: 200, clientY: 200 });

    expect(capture).toHaveBeenCalledWith(7);
    expect(screen.getByRole("status")).toHaveTextContent("경기장 빈 곳에 배치했습니다");
    expect(hero).toHaveAttribute("data-min-target", "44");
  });

  it("Given 선택한 영웅 When 경기장에서 Enter를 누르면 Then 키보드로 자유 배치한다", async () => {
    const user = userEvent.setup();
    render(<CapybaraDefense random={() => 0} />);
    await user.click(screen.getByRole("button", { name: /영웅 뽑기/ }));
    const canvas = screen.getByLabelText("갈대 습지 전장 화면");
    canvas.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("status")).toHaveTextContent("경기장 빈 곳에 배치했습니다");
  });

  it("Given 네 직업 When 공격 표현을 조회하면 Then 서로 다른 타이밍·텍스트·원본 PNG 프레임을 사용한다", () => {
    const classes = ["warrior", "archer", "rogue", "mage"] as const;
    const presentations = classes.map(getClassAttackPresentation);
    expect(new Set(presentations.map((entry) => entry.timingMs)).size).toBe(4);
    expect(new Set(presentations.map((entry) => entry.cue)).size).toBe(4);
    for (const heroClass of classes) {
      const frame = getClassEffectFrame(heroClass);
      expect(frame.atlas).toBe("units");
      expect(frame.width).toBeGreaterThanOrEqual(128);
      expect(frame.height).toBeGreaterThanOrEqual(128);
    }
  });

  it("Given 실제 진행도를 가진 몬스터 When 캔버스를 그리면 Then 지도 길 좌표에 렌더링한다", () => {
    const drawImage = vi.fn();
    const context = {
      arc: vi.fn(), beginPath: vi.fn(), clearRect: vi.fn(), drawImage, fillRect: vi.fn(), fillText: vi.fn(),
      setLineDash: vi.fn(), setTransform: vi.fn(), stroke: vi.fn(), strokeRect: vi.fn(), translate: vi.fn(),
      fillStyle: "", font: "", lineWidth: 0, strokeStyle: "",
    } as unknown as CanvasRenderingContext2D;
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: vi.fn(() => context),
    });
    vi.stubGlobal("Image", class {
      complete = true;
      decoding = "async";
      src = "";
      addEventListener(): void {}
    });
    const canvas = document.createElement("canvas");
    canvas.getBoundingClientRect = () => ({ width: 1_000, height: 600, top: 0, right: 1_000, bottom: 600, left: 0, x: 0, y: 0, toJSON: () => ({}) });

    renderDefenseFrame(canvas, {
      mapId: "reed-marsh", round: 7,
      monsters: [{ progress: 0.5, health: 80, maxHealth: 100, boss: false }],
      units: [], damageNumbers: false, screenShake: false, reducedMotion: false, targeting: false,
    });
    renderDefenseFrame(canvas, {
      mapId: "reed-marsh", round: 7,
      monsters: [{ progress: 0.5, health: 80, maxHealth: 100, boss: false }],
      units: [], damageNumbers: false, screenShake: false, reducedMotion: false, targeting: false,
    });

    const monsterCall = drawImage.mock.calls.find((call) => call[3] === 240 && call[4] === 200);
    expect(monsterCall).toBeDefined();
    const point = getMonsterRenderPoint("reed-marsh", 0.5);
    const size = 45;
    expect(monsterCall?.[5]).toBeCloseTo(point[0] * 1_000 - size / 2);
    expect(monsterCall?.[6]).toBeCloseTo(point[1] * 600 - size / 2);
  });

  it("Given 시작 화면 When 게임이 열리면 Then 등록된 게임과 무작위 전장을 바로 표시한다", async () => {
    render(<CapybaraDefense random={() => 0.4} />);
    expect(getGame("capybara-defense")?.title).toBe("카피바라 디펜스");
    expect(await screen.findByLabelText("온천 계곡 전장 화면")).toBeInTheDocument();
  });

  it("Given 선택한 지도 When 게임을 시작하면 Then 준비 HUD와 모든 핵심 패널을 연다", async () => {
    render(<CapybaraDefense />);
    await screen.findByRole("application", { name: "카피바라 디펜스 전장" });
    expect(screen.getByRole("application", { name: "카피바라 디펜스 전장" })).toBeInTheDocument();
    for (const label of ["생명", "도토리", "라운드", "남은 시간", "마나", "속도"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    for (const name of ["영웅", "장비", "강화"]) {
      expect(screen.getByRole("button", { name: `${name} 패널 열기` })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "확률 보기" })).toBeInTheDocument();
  });

  it("Given 준비 단계 When 뽑기와 배치를 하면 Then 돈과 배치 피드백을 알린다", async () => {
    const user = userEvent.setup();
    render(<CapybaraDefense />);
    await screen.findByRole("application", { name: "카피바라 디펜스 전장" });
    await user.click(screen.getByRole("button", { name: /영웅 뽑기/ }));
    expect(screen.getByRole("status")).toHaveTextContent(/영웅|도토리/);
    await user.click(screen.getByRole("button", { name: /빈 배치 칸 1/ }));
    expect(screen.getByRole("status")).toHaveTextContent(/배치/);
  });

  it("Given 전투 중 When 화면을 검사하면 Then 광고와 SVG 아이콘을 처리하지 않는다", async () => {
    const user = userEvent.setup();
    const { container } = render(<CapybaraDefense />);
    await screen.findByRole("application", { name: "카피바라 디펜스 전장" });
    await user.click(screen.getByRole("button", { name: "전투 시작" }));
    expect(container.querySelector("script[src*='ads'], iframe, ins.adsbygoogle")).toBeNull();
    expect(container.querySelector("svg")).toBeNull();
    expect(screen.queryByRole("button", { name: "확률 보기" })).toBeNull();
    expect(container.querySelector("[data-phase='combat']")).toBeInTheDocument();
  });

  it("Given 결과 장면 When 통계를 열면 Then 실제 집계의 네 직업 피해를 모두 표시한다", async () => {
    window.history.replaceState({}, "", "/games/capybara-defense?defenseFixture=result");
    render(<CapybaraDefense />);

    for (const label of ["전사 피해", "궁수 피해", "도적 피해", "마법사 피해"]) {
      expect(await screen.findByText(new RegExp(label))).toBeInTheDocument();
    }
  });

  it("Given 역순 슬롯 체크포인트 When 이어하면 Then 영웅과 칸을 그대로 복원한다", async () => {
    const first = drawHero(createHeroInventory(), () => 0);
    if (!first.ok) throw new Error("first fixture draw failed");
    const second = drawHero(first.state, () => 0.3);
    if (!second.ok) throw new Error("second fixture draw failed");
    const buildSlots = PLACEMENT_ZONES["reed-marsh"].filter((zone) => zone.kind === "slot");
    const firstSlot = buildSlots[0];
    const thirdSlot = buildSlots[2];
    if (firstSlot === undefined || thirdSlot === undefined) throw new Error("fixture slot missing");
    writeDefenseSave(window.localStorage, {
      mapId: "reed-marsh", round: 10, phase: "preparation", lives: 18, mana: 42, heroInventory: second.state,
      placement: createPlacementState("reed-marsh", [
        { unitId: second.unit.id, slotId: thirdSlot.id, priority: "first", range: 160, investedCost: 3 },
        { unitId: first.unit.id, slotId: firstSlot.id, priority: "first", range: 160, investedCost: 3 },
      ], second.state.economy.money),
      equipment: { inventory: createEmptyInventory(), loadout: createEmptyLoadout() },
    });
    const user = userEvent.setup();
    render(<CapybaraDefense />);

    await user.click(await screen.findByRole("button", { name: "저장된 10라운드 이어하기" }));

    expect(screen.getByRole("button", { name: /배치 칸 1 · 전사 배치됨/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /배치 칸 3 · 궁수 배치됨/ })).toBeInTheDocument();
  });

  it("Given 독립 소리 설정 When 효과음을 끄면 Then 배경음만 유지한다", async () => {
    const starts = vi.fn();
    class FakeAudioContext {
      readonly currentTime = 0;
      readonly destination = {};
      createOscillator() { return { type: "sine", frequency: { value: 0 }, connect() { return this; }, start: starts, stop: vi.fn(), addEventListener: vi.fn() }; }
      createGain() { return { gain: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect() { return this; } }; }
      close() { return Promise.resolve(); }
    }
    vi.stubGlobal("AudioContext", FakeAudioContext);
    const user = userEvent.setup();
    render(<CapybaraDefense />);
    await screen.findByRole("application", { name: "카피바라 디펜스 전장" });
    await waitFor(() => expect(starts).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole("button", { name: "효과음 켬" }));
    await user.click(screen.getByRole("button", { name: /영웅 뽑기/ }));

    expect(starts).toHaveBeenCalledTimes(1);
  });

  it("Given 같은 등급 영웅 셋 When 조작 버튼을 누르면 Then 실제 합성·되돌리기·우선순위·판매 상태가 바뀐다", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const user = userEvent.setup();
    render(<CapybaraDefense />);
    await screen.findByRole("application", { name: "카피바라 디펜스 전장" });
    const draw = screen.getByRole("button", { name: /영웅 뽑기/ });
    await user.click(draw);
    await user.click(draw);
    await user.click(draw);

    await user.click(screen.getByRole("button", { name: "합성" }));
    expect(screen.getByRole("status")).toHaveTextContent("5초 안에");
    await user.click(screen.getByRole("button", { name: "합성 되돌리기" }));
    expect(screen.getByRole("status")).toHaveTextContent("되돌렸습니다");

    const heroes = screen.getAllByRole("button").filter((button) => button.textContent?.includes("대기 중"));
    const selectedHero = heroes[0];
    if (selectedHero === undefined) throw new Error("hero button missing");
    await user.click(selectedHero);
    await user.click(screen.getByRole("button", { name: "타깃 우선순위" }));
    expect(screen.getByRole("status")).toHaveTextContent("후미");
    await user.click(screen.getByRole("button", { name: "판매" }));
    expect(screen.getByRole("status")).toHaveTextContent("돌려받았습니다");
    expect(screen.getAllByRole("button").filter((button) => button.textContent?.includes("대기 중"))).toHaveLength(2);
  });

  it("Given 전사 영웅과 마나 When 함성을 쓰면 Then 스킬 엔진이 마나와 재사용 대기를 적용한다", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const user = userEvent.setup();
    render(<CapybaraDefense />);
    await screen.findByRole("application", { name: "카피바라 디펜스 전장" });
    await user.click(screen.getByRole("button", { name: /영웅 뽑기/ }));
    await user.click(screen.getByRole("button", { name: /함성 스킬/ }));

    expect(screen.getByText("30 / 100")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("함성을 사용했습니다");
    expect(screen.getByRole("button", { name: /함성 스킬/ })).toHaveTextContent("초");
  });

  it("Given 초기 안내 When 전장을 열면 Then 내부 튜토리얼 식별자 대신 한국어 단계를 표시한다", async () => {
    render(<CapybaraDefense />);
    await screen.findByRole("application", { name: "카피바라 디펜스 전장" });

    expect(screen.getByText("첫 수비 안내 · 뽑기")).toBeInTheDocument();
    expect(screen.queryByText("첫 수비 안내 · draw")).toBeNull();
    expect(screen.getByText(/신속/)).toBeInTheDocument();
    expect(screen.queryByText(/swift/)).toBeNull();
  });

  it("Given 빈 무기 칸과 희귀 장비 When 장비 패널을 열면 Then 0%와 한국어 등급·슬롯을 표시한다", async () => {
    writeDefenseSave(window.localStorage, {
      mapId: "reed-marsh", round: 10, phase: "preparation", lives: 20, mana: 65, heroInventory: createHeroInventory(),
      placement: createPlacementState("reed-marsh", [], 10),
      equipment: {
        inventory: {
          items: [{
            id: "equipment-rare-bow", slot: "weapon", rarity: "rare", requiredClass: "warrior", source: "boss",
            effect: { attackBonus: 0.1, shieldBonus: 0, attackSpeedBonus: 0, rangeBonus: 0, manaBonus: 0, cooldownReduction: 0, skillEffectBonus: 0 },
          }],
          collectedIds: ["equipment-rare-bow"],
        },
        loadout: createEmptyLoadout(),
      },
    });
    const user = userEvent.setup();
    render(<CapybaraDefense />);

    await user.click(await screen.findByRole("button", { name: "저장된 10라운드 이어하기" }));
    await user.click(screen.getByRole("button", { name: "장비 패널 열기" }));

    expect(screen.getByText("공격 +0%")).toBeInTheDocument();
    expect(screen.getByText("희귀 · 무기 · 보관 중")).toBeInTheDocument();
    expect(screen.queryByText(/rare · weapon/)).toBeNull();
  });

  it("Given 영웅과 확률 목록 When 등급을 표시하면 Then 내부 영문 등급 키를 노출하지 않는다", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const user = userEvent.setup();
    render(<CapybaraDefense />);
    await screen.findByRole("application", { name: "카피바라 디펜스 전장" });
    await user.click(screen.getByRole("button", { name: /영웅 뽑기/ }));

    expect(screen.getByText("전사 · 일반")).toBeInTheDocument();
    expect(screen.queryByText("전사 · common")).toBeNull();
    expect(screen.queryByText("장비 등급 확률")).toBeNull();
    const trigger = screen.getByRole("button", { name: "확률 보기" });
    trigger.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("dialog", { name: "확률 안내" })).toBeInTheDocument();
    expect(screen.getByText("장비 등급 확률")).toBeInTheDocument();
    expect(screen.getByText("티켓 도전 성공")).toBeInTheDocument();
    expect(screen.queryByText("common")).toBeNull();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "확률 안내" })).toBeNull();
    expect(trigger).toHaveFocus();
  });
});
