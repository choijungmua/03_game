import { AVATAR_SIZE, SLOT } from "./constants";

export const AVATAR_STYLES = {
  root: `group relative flex size-8 shrink-0 rounded-full select-none overflow-visible ${AVATAR_SIZE.root}`,
  image: "aspect-square size-full rounded-full object-cover",
  fallback: `bg-background text-text-caption flex size-full items-center justify-center rounded-full text-caption-1 ${AVATAR_SIZE.fallback}`,
  badge: `bg-primary text-primary-foreground ring-background absolute right-0 bottom-0 z-10 inline-flex size-2.5 items-center justify-center rounded-full ring-2 select-none translate-x-[5%] translate-y-[5%] [&>svg]:size-2 ${AVATAR_SIZE.badge}`,
  group: `*:data-[slot=${SLOT.ROOT}]:ring-background group/avatar-group flex -space-x-2 *:data-[slot=${SLOT.ROOT}]:ring-2`,
  groupCount: `bg-background text-text-caption ring-background relative flex size-8 shrink-0 items-center justify-center rounded-full text-caption-1 ring-2 ${AVATAR_SIZE.groupCount} [&>svg]:size-4`,
}
