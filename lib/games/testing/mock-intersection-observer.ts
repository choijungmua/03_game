import { act } from "@testing-library/react";
import { vi } from "vitest";

/**
 * jsdom에는 IntersectionObserver가 없어서 테스트에서 "화면에 보임/안 보임"을 직접 흘려보낸다.
 * 반환 함수를 호출하면 현재 관찰 중인 모든 요소에 교차 상태를 전달한다.
 */
export function mockIntersectionObserver() {
  const observers = new Set<MockIntersectionObserver>();

  class MockIntersectionObserver implements IntersectionObserver {
    readonly root = null;
    readonly rootMargin = "";
    readonly thresholds: readonly number[] = [];
    readonly callback: IntersectionObserverCallback;

    constructor(callback: IntersectionObserverCallback) {
      this.callback = callback;
    }

    observe() {
      observers.add(this);
    }

    unobserve() {
      observers.delete(this);
    }

    disconnect() {
      observers.delete(this);
    }

    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }

  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);

  return async function setIntersecting(isIntersecting: boolean) {
    await act(async () => {
      observers.forEach((observer) => {
        observer.callback([{ isIntersecting } as IntersectionObserverEntry], observer);
      });
    });
  };
}
