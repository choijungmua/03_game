import { SLOT } from "./constants";

export const CARD_STYLES = {
  root: "bg-card text-text-strong flex flex-col gap-6 rounded-xl border border-border-default py-6",
  header: `@container/${SLOT.HEADER} grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=${SLOT.ACTION}]:grid-cols-[1fr_auto] [.border-b]:pb-6`,
  title: "leading-none font-semibold",
  description: "text-text-caption text-sm",
  action: "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
  content: "px-6",
  footer: "flex items-center px-6 [.border-t]:pt-6",
}
