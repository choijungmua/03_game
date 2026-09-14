import { type RefObject, useEffect, useEffectEvent } from "react";

/**
 * 화면 프레임마다 요소의 글자를 DOM에 바로 쓴다. 초시계처럼 계속 바뀌는 숫자를 React 렌더 없이 보여줄 때 쓴다
 * (setState 타이머면 1초에 수백 번 컴포넌트를 다시 그린다)
 */
export function useFrameText(ref: RefObject<HTMLElement | null>, read: () => string) {
  const readLatest = useEffectEvent(read);

  useEffect(() => {
    let frame = requestAnimationFrame(function tick() {
      if (ref.current) ref.current.textContent = readLatest();
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [ref]);
}
