import { useEffect, useRef, useState } from "react";

/** active일 때만 요소가 화면에 들어왔는지 관찰한다. active가 꺼지면 다시 안 보이는 상태부터 시작한다 */
export function useInView<T extends Element>(active: boolean, threshold = 0.2) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  const [prevActive, setPrevActive] = useState(active);

  if (active !== prevActive) {
    setPrevActive(active);
    setInView(false);
  }

  useEffect(() => {
    const node = ref.current;
    if (!active || !node) return;

    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      threshold,
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [active, threshold]);

  return { ref, inView };
}
