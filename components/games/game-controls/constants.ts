/** ShareButton과 같은 둥근 버튼. 색은 currentColor라 게임 배경색을 따라간다 */
export const ROUND_BUTTON =
  "absolute top-[max(1rem,env(safe-area-inset-top))] z-20 inline-flex size-11 cursor-pointer touch-manipulation items-center justify-center rounded-full bg-current/10 transition-colors hover:bg-current/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current";

/** 온라인 대국 중 뒤로 버튼 확인 문구 (바둑·오목·알까기) */
export const LEAVE_CONFIRM_MESSAGE = "나가면 상대가 기다리게 돼요";
