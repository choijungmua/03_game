import { notFound } from "next/navigation";

import { SoundBoard } from "./sound-board";

/** 개발할 때만 여는 효과음 미리듣기 (배포본에서는 404) */
export default function SoundsPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <SoundBoard />;
}
