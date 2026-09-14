import { LegalPage } from "@/app/_legal/legal-page";
import { pageMetadata } from "@/lib/seo/site";

import { TermsContent } from "./terms-content";

export const metadata = pageMetadata({
  title: "terms",
  description: "ggpli 서비스 이용약관",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <LegalPage title="이용약관">
      <TermsContent />
    </LegalPage>
  );
}
