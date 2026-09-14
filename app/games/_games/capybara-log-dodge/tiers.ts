const CHARACTER_BASE = "/assets/images/characters/capybara";

export interface LogDodgeTier {
  label: string;
  /** 버틴 시간(초)이 이 값 이상이면 이 등급 */
  minSeconds: number;
  description: string;
  bgClass: string;
  fgClass: string;
  /** 결과 화면 카피바라 (기존 캐릭터 그림 재사용) */
  image: string;
}

export const LOG_DODGE_TIERS: readonly LogDodgeTier[] = [
  {
    label: "온천의 신",
    minSeconds: 60,
    description: "최고 속도 통나무 속에서도 온천까지 달려갔어요",
    bgClass: "bg-violet-600",
    fgClass: "text-white",
    image: `${CHARACTER_BASE}/capybara-idle-down.webp`,
  },
  {
    label: "산사태 속 평온",
    minSeconds: 40,
    description: "쪼개지는 통나무도 태연하게 피했어요",
    bgClass: "bg-primary",
    fgClass: "text-white",
    image: `${CHARACTER_BASE}/capybara-stand-down.webp`,
  },
  {
    label: "통나무 서퍼",
    minSeconds: 25,
    description: "튕기는 통나무까지 넘긴 실력이에요",
    bgClass: "bg-success",
    fgClass: "text-neutral-950",
    image: `${CHARACTER_BASE}/capybara-walk1-down.webp`,
  },
  {
    label: "굴러다니는 카피바라",
    minSeconds: 12,
    description: "통나무 벽의 틈을 찾기 시작했어요",
    bgClass: "bg-warning",
    fgClass: "text-neutral-950",
    image: `${CHARACTER_BASE}/capybara-punch-down.webp`,
  },
  {
    label: "통나무 밑 납작 카피바라",
    minSeconds: 0,
    description: "통나무가 오는 방향의 반대로 달려 보세요",
    bgClass: "bg-destructive",
    fgClass: "text-neutral-950",
    image: `${CHARACTER_BASE}/capybara-stun.webp`,
  },
];

export function getLogDodgeTier(timeMs: number): LogDodgeTier {
  const seconds = timeMs / 1000;
  return LOG_DODGE_TIERS.find((tier) => seconds >= tier.minSeconds) ?? LOG_DODGE_TIERS[LOG_DODGE_TIERS.length - 1];
}

export function getLogDodgeTierRangeLabel(tier: LogDodgeTier): string {
  const index = LOG_DODGE_TIERS.indexOf(tier);
  if (index === 0) return `${tier.minSeconds}초 이상`;
  return `${tier.minSeconds}–${LOG_DODGE_TIERS[index - 1].minSeconds}초 미만`;
}
