import { expect, it } from "vitest";

import { absoluteUrl, pageMetadata } from "./site";

it("별도 이미지가 없는 페이지에도 기본 공유 이미지를 제공한다", () => {
  const input = { title: "방명록", description: "방명록 안내", path: "/guestbook", imagePath: "/opengraph-image" };

  const metadata = pageMetadata(input);

  expect(metadata.openGraph).toEqual(expect.objectContaining({ images: [absoluteUrl("/opengraph-image")] }));
  expect(metadata.twitter).toEqual(expect.objectContaining({ images: [absoluteUrl("/opengraph-image")] }));
});

it("파일 기반 공유 이미지를 공통 이미지로 덮어쓰지 않는다", () => {
  const metadata = pageMetadata({ title: "카피바라", description: "카피바라 안내", path: "/capybara" });

  expect(metadata.openGraph).not.toHaveProperty("images");
  expect(metadata.twitter).not.toHaveProperty("images");
});
