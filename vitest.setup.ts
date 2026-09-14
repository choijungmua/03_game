import "@testing-library/jest-dom/vitest";

import { beforeEach, vi } from "vitest";

// 테스트가 로컬 백엔드(localhost:4000)에 실제 입장·기록·공유를 보내지 않게 네트워크를 기본으로 막는다.
// 요청 내용을 검사해야 하는 테스트는 직접 fetch를 stub한다
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("테스트에서는 네트워크 요청을 막아둔다"))));
});
