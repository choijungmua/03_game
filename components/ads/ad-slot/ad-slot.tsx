import type { AdSlotProps } from "./type";

// TODO: 애드센스 승인 후 이 컴포넌트 내부만 실제 광고 코드로 교체 (CLAUDE.md "광고" 절 참고)
export function AdSlot({ placement }: AdSlotProps) {
  return (
    <div
      data-ad-placement={placement}
      className="flex h-24 w-full items-center justify-center rounded-lg border border-dashed border-border-default text-caption-3 text-text-caption"
    >
      광고 영역
    </div>
  );
}
