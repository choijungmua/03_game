// 다른 유저를 받은 위치로 순간이동시키지 않고, 받은 시각 기준으로 조금 과거를 부드럽게 그린다

import { MAX_SNAPSHOTS, SNAPSHOT_RESTART_MS } from "./constants";

export interface Snapshot {
  x: number;
  y: number;
  /** 받은 시각(performance.now 기준 ms) */
  at: number;
}

/**
 * 받은 위치를 쌓는다. stepMs는 평소 수신 간격(폴링 주기).
 * 같은 위치가 또 오면 쌓지 않는다 — 두 유저의 폴링이 엇갈리면 서버에 새 위치가 아직 안 올라온 것이라,
 * 쌓으면 그 구간에서 멈칫했다가 다음 구간에서 두 배로 달려 끊겨 보인다
 */
export function pushSnapshot(buffer: Snapshot[], x: number, y: number, at: number, stepMs: number) {
  const last = buffer.at(-1);
  if (last && last.x === x && last.y === y) return;
  // 오래 서 있다가 걷기 시작하면 서 있던 긴 시간에 걸쳐 느리게 오지 않도록, 한 틱 전에 그 자리에 있었던 것으로 둔다
  if (last && at - last.at > SNAPSHOT_RESTART_MS) buffer.push({ x: last.x, y: last.y, at: at - stepMs });
  buffer.push({ x, y, at });
  if (buffer.length > MAX_SNAPSHOTS) buffer.splice(0, buffer.length - MAX_SNAPSHOTS);
}

/** renderAt 시각의 위치. 이미 지나간 스냅샷은 버퍼에서 버린다 */
export function sampleSnapshots(buffer: Snapshot[], renderAt: number): { x: number; y: number } {
  while (buffer.length > 2 && buffer[1].at <= renderAt) buffer.shift();
  const [from, to] = buffer;
  if (!to || renderAt <= from.at) return { x: from.x, y: from.y };
  if (renderAt >= to.at) return { x: to.x, y: to.y };
  const t = (renderAt - from.at) / (to.at - from.at);
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
}
