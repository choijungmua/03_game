import { Loading } from "@/components/feedback/loading";

/** 로비에서 게임으로 넘어가는 동안: 가운데 걷는 카피바라 + 프로그레스 바 */
export default function GameLoading() {
  return (
    <main className="flex h-dvh w-dvw items-center justify-center bg-background">
      <Loading description="게임 불러오는 중…" />
    </main>
  );
}
