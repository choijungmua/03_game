import { Check } from "lucide-react";

import { Badge } from "@/components/display/badge";
import { Card } from "@/components/display/card";
import { Button } from "@/components/inputs/button";
import { Input } from "@/components/inputs/input";

import { DESIGN_SYSTEM_FEATURES } from "./constants";
import type { DesignSystemFeature } from "./types";

function Feature({ children }: Readonly<{ children: DesignSystemFeature }>) {
  return (
    <li className="flex items-start gap-3 text-sm text-text-normal">
      <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
      <span>{children}</span>
    </li>
  );
}

export function DesignSystemPreview() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl items-center px-5 py-12 sm:px-8">
      <Card className="w-full overflow-hidden border-border-default bg-card shadow-xl">
        <Card.Header className="border-b border-border-default bg-bg-neutral/60">
          <div className="space-y-2">
            <Badge variant="outline">Design system</Badge>
            <Card.Title className="text-title-1">ZMZM 기반 다크 UI</Card.Title>
            <Card.Description>
              shadcn/ui와 역할별 컴포넌트 구조를 현재 프로젝트에 맞게 정리했습니다.
            </Card.Description>
          </div>
        </Card.Header>
        <Card.Content className="grid gap-8 py-8 md:grid-cols-[1.2fr_0.8fr]">
          <section className="space-y-5" aria-labelledby="structure-title">
            <div className="space-y-1">
              <h2 id="structure-title" className="text-title-3 font-semibold text-text-strong">
                구성 원칙
              </h2>
              <p className="text-caption-1 text-text-caption">
                화면 코드는 짧게 유지하고 재사용 범위를 폴더 구조로 드러냅니다.
              </p>
            </div>
            <ul className="space-y-3">
              {DESIGN_SYSTEM_FEATURES.map((feature) => (
                <Feature key={feature}>{feature}</Feature>
              ))}
            </ul>
          </section>
          <section className="space-y-4 rounded-xl border border-border-default bg-background/60 p-5" aria-labelledby="component-title">
            <h2 id="component-title" className="text-caption-1 font-semibold text-text-strong">
              컴포넌트 미리보기
            </h2>
            <Input aria-label="플레이어 이름" placeholder="플레이어 이름" />
            <div className="flex flex-wrap gap-2">
              <Button>게임 시작</Button>
              <Button variant="outline">설정 보기</Button>
            </div>
          </section>
        </Card.Content>
      </Card>
    </main>
  );
}
