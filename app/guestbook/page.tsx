import { LegalPage } from "@/app/_legal/legal-page";
import { pageMetadata } from "@/lib/seo/site";

import { GuestbookBoard } from "./guestbook-board";

export const metadata = pageMetadata({
  title: "방명록",
  description: "ggpli에 다녀간 흔적을 한 줄 남겨 주세요",
  path: "/guestbook",
});

export default function GuestbookPage() {
  return (
    <LegalPage title="방명록">
      <GuestbookBoard />
    </LegalPage>
  );
}
