import { LegalPage } from "@/app/_legal/legal-page";
import { pageMetadata } from "@/lib/seo/site";

import { PrivacyContent } from "./privacy-content";

export const metadata = pageMetadata({
  title: "privacy",
  description: "ggpli 개인정보처리방침",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <LegalPage title="개인정보처리방침">
      <PrivacyContent />
    </LegalPage>
  );
}
