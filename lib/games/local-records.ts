import { useMemo, useSyncExternalStore } from "react";

const EMPTY_SNAPSHOT = "[]";

/** 저장소에서 읽은 값은 필드가 빠졌거나 타입이 틀릴 수 있으므로 Partial로 받아 검사한다 */
export type RecordGuard<T> = (value: Partial<T> | null) => value is T;

export function parseStoredRecords<T>(raw: string | null, isRecord: RecordGuard<T>): T[] {
  if (!raw) return [];
  try {
    const parsed: Partial<T>[] | null = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isRecord) : [];
  } catch {
    return [];
  }
}

/** 브라우저 localStorage에 게임 기록을 저장하고, 바뀌면 구독 중인 화면을 다시 그린다 */
export function createLocalRecordStore<T>(storageKey: string, isRecord: RecordGuard<T>) {
  const listeners = new Set<() => void>();

  function subscribe(listener: () => void) {
    listeners.add(listener);
    window.addEventListener("storage", listener);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", listener);
    };
  }

  function getSnapshot() {
    try {
      return window.localStorage.getItem(storageKey) ?? EMPTY_SNAPSHOT;
    } catch {
      return EMPTY_SNAPSHOT;
    }
  }

  function getServerSnapshot() {
    return EMPTY_SNAPSHOT;
  }

  function save(records: readonly T[]) {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(records));
    } catch {
      // 저장소 접근이 막힌 환경(사생활 보호 모드 등)에서는 기록을 남기지 않는다
    }
    listeners.forEach((listener) => listener());
  }

  function useRecords() {
    const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
    return useMemo(() => parseStoredRecords(raw, isRecord), [raw]);
  }

  return { save, useRecords };
}
