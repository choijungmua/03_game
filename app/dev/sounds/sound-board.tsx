"use client";

import { countdownSound, GAME_SOUNDS } from "@/lib/games/constants";
import { SOUNDS } from "@/lib/lobby/constants";
import { FX_SAMPLES, playGameSound, VOICE_LINES, type SoundLayer } from "@/lib/lobby/settings";

const GROUPS: { title: string; sounds: Record<string, readonly SoundLayer[]> }[] = [
  { title: "공용 게임 효과음", sounds: { ...GAME_SOUNDS, "countdown 3": countdownSound(3), "countdown 2": countdownSound(2), "countdown 1": countdownSound(1) } },
  { title: "로비", sounds: SOUNDS },
  {
    title: "카피바라 중얼거림 · CC0 효과음 (원본)",
    sounds: Object.fromEntries([...VOICE_LINES, ...FX_SAMPLES].map((line) => [line, [{ kind: "voice", line, from: 12000, to: 12000, ms: 2000, level: 0.85 }]])),
  },
];

export function SoundBoard() {
  return (
    <main className="mx-auto max-w-4xl space-y-8 p-4">
      <h1 className="text-2xl font-bold">효과음 미리듣기</h1>
      {GROUPS.map((group) => (
        <section key={group.title} className="space-y-3">
          <h2 className="text-lg font-semibold">{group.title}</h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(group.sounds).map(([name, layers]) => (
              <button
                key={name}
                type="button"
                onClick={() => playGameSound(layers)}
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
              >
                {name}
              </button>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
