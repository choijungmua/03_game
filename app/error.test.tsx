import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ErrorPage from "./error";

describe("에러 화면", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("오류를 알리고, 다시 시도·처음으로 두 갈래를 준다", () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const retry = vi.fn();
    const error = new Error("pieces is not iterable");

    render(<ErrorPage error={error} retry={retry} />);

    expect(screen.getByRole("heading", { name: "문제가 생겼어요" })).toBeInTheDocument();
    expect(logged).toHaveBeenCalledWith(error);

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("link", { name: "처음으로" })).toHaveAttribute("href", "/");
  });
});
