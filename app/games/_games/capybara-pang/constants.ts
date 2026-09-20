import type { SoundLayer } from "@/lib/lobby/settings";

export const BOARD_SIZE = 7;

/** 동물 펠트 얼굴 그림 폴더. 평소 얼굴은 <key>.webp, 터질 때 우는 얼굴은 <key>-cry.webp */
export const ANIMAL_IMAGE_BASE = "/assets/images/games/capybara-pang/animals";

/**
 * 판에 나오는 동물: 카피바라와 남미 습지에 같이 사는 친구들. 색 원 위에 펠트 얼굴 그림을 얹는다.
 * 색만으로 구분하지 않게 원 색도 얼굴 모양도 7종이 모두 다르다 (갈색·회색·연두·노랑·빨강·분홍·하늘)
 */
export const ANIMALS = [
  { key: "capybara", name: "카피바라", colorClass: "bg-amber-600 text-white" },
  { key: "otter", name: "수달", colorClass: "bg-slate-500 text-white" },
  { key: "frog", name: "청개구리", colorClass: "bg-lime-400 text-neutral-950" },
  { key: "duckling", name: "아기오리", colorClass: "bg-yellow-300 text-neutral-950" },
  { key: "macaw", name: "마코앵무새", colorClass: "bg-red-500 text-white" },
  { key: "dolphin", name: "분홍 강돌고래", colorClass: "bg-pink-300 text-neutral-950" },
  { key: "sloth", name: "나무늘보", colorClass: "bg-sky-400 text-neutral-950" },
] as const;

export const KIND_COUNT = ANIMALS.length;

/** 한 판 시간 */
export const ROUND_SECONDS = 60;

/** 블록 한 개 점수 */
export const TILE_POINTS = 5_000;
export const EXTRA_CLEAR_POINTS = 2_000;
export const SPECIAL_CLEAR_POINTS = 25_000;
export const REMAINING_SECOND_POINTS = 100;
export const COMBO_MULTIPLIER_STEP = 5;
export const COMBO_MULTIPLIER_CAP = 1_024;
/** 마지막으로 터진 뒤 이 시간 안에 또 터뜨려야 콤보가 이어진다 */
export const COMBO_WINDOW_MS = 2000;
/** 콤보가 이 수의 배수가 될 때마다 피버 */
export const FEVER_COMBO = 10;
export const FEVER_MS = 8000;
export const FEVER_MULTIPLIER = 2;
export const TIME_BONUS_SECONDS = 1;
export const TIME_BONUS_COMBO_STEP = 5;
export const TIME_BONUS_CAP_SECONDS = 10;

/**
 * 바꾸기·터지기·떨어지기 애니메이션 시간. 터지기·떨어지기는 globals.css pang-pop(0.46s)·pang-drop(0.3s)과 같아야 한다.
 * 터지기는 우는 얼굴로 흔들며 버티다(앞 48%) 풍선처럼 부풀어 펑 — 순식간에 사라지지 않고 표정이 보이게 천천히
 */
export const SWAP_MS = 140;
export const POP_MS = 460;
export const FALL_MS = 300;
/** 터지는 중 펑(pang-pop 48%)에 맞춰 눈물·반짝이가 튀어나가기 시작하는 시각 */
export const BURST_AT_MS = Math.round(POP_MS * 0.48);
/** 동물 표정 그림 (파일 이름 뒤에 붙는 말): 평소 / 눈웃음(깜빡임·고를 때) / 우는 얼굴(터질 때) */
export const ANIMAL_FACES = { calm: "", happy: "-happy", cry: "-cry" } as const;
/** 터질 때 튀어나가는 조각: 눈물 둘(좌우) + 반짝이 넷. dx·dy는 블록 크기 대비 날아가는 거리(%) */
export const POP_SPARKS = [
  { kind: "tear", dx: -85, dy: -10 },
  { kind: "tear", dx: 85, dy: -10 },
  { kind: "star", dx: -55, dy: -80 },
  { kind: "star", dx: 55, dy: -80 },
  { kind: "star", dx: -65, dy: 70 },
  { kind: "star", dx: 65, dy: 70 },
] as const;
/** 한 번에 이만큼 넘게 터지면 판이 흔들린다 */
export const SHAKE_CLEAR_COUNT = 5;

/** 남은 시간이 이만큼이면 서두르기: 시간 막대가 빨개지고 판 둘레가 붉게 두근거리며 초마다 째깍 */
export const HURRY_SECONDS = 10;
/** 남은 시간이 이만큼부터는 판 위에 큰 숫자(5·4·3·2·1)가 초마다 튀어나온다 */
export const BIG_COUNT_SECONDS = 5;
/**
 * 라스트 팡: 시간이 끝나면 "타임 오버!"를 보여 주고(진행 중이던 연쇄는 끝까지), 판에 남은 폭탄·무지개가 있으면
 * "라스트 팡!" 뒤 하나씩 터뜨려 점수를 더한 다음 결과 화면으로 간다. 보너스는 콤보·피버 없이 블록 수대로
 */
export const TIME_OVER_MS = 900;
export const LAST_PANG_INTRO_MS = 700;
export const LAST_PANG_OUTRO_MS = 900;

/** 이 시간 동안 아무것도 안 하면 둘 수 있는 자리를 반짝여 알려준다 */
export const HINT_DELAY_MS = 5000;

/** 끌어서 바꾸기로 보는 최소 거리 (블록 크기 대비) */
export const DRAG_THRESHOLD = 0.35;

/** 결과 화면이 뜬 뒤 이 시간 동안은 탭·Space·Enter로 다시 시작하지 않는다 */
export const RESULT_TAP_GUARD_MS = 1000;
/** 시간 끝 소리 뒤에 결과 소리가 이어지도록 미루는 시간 */
export const RESULT_SOUND_DELAY_MS = 380;
/** 이 등급 순서(PANG_TIERS 인덱스)부터는 결과 소리를 실패로 낸다 */
export const FAIL_TIER_INDEX = 3;

export const PANG_SOUNDS = {
  /** 팡: 블록이 터짐 */
  pop: [
    { kind: "tone", wave: "sine", from: 700, to: 1400, ms: 90, level: 0.12 },
    { kind: "noise", filter: "bandpass", q: 2, from: 2400, to: 1600, ms: 60, level: 0.08 },
  ],
  /** 째깍: 마지막 10초 동안 초마다 (3·2·1은 카운트다운 삐가 대신한다) */
  tick: [{ kind: "tone", wave: "sine", from: 1500, to: 1300, ms: 45, level: 0.07 }],
  /** 쾅: 라스트 팡으로 남은 폭탄·무지개가 터짐 */
  lastPang: [
    { kind: "noise", filter: "lowpass", q: 1, from: 1400, to: 200, ms: 260, level: 0.16 },
    { kind: "tone", wave: "triangle", from: 220, to: 70, ms: 240, level: 0.12 },
    { kind: "tone", wave: "sine", from: 880, to: 1760, ms: 120, level: 0.08, at: 60 },
  ],
  /** 삐―: 시간 끝 */
  timeUp: [
    { kind: "tone", wave: "square", from: 523, to: 523, ms: 320, level: 0.07 },
    { kind: "tone", wave: "sine", from: 1046, to: 1040, ms: 320, level: 0.08 },
  ],
} as const satisfies Record<string, readonly SoundLayer[]>;
