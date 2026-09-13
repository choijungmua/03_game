import { cn } from "@/lib"
import { AVATAR_STYLES } from "../variable"
import { AvatarGroupProps } from "../type"
import { SLOT } from "../constants"

export function Group({ className, ...props }: AvatarGroupProps) {
  return (
    <div
      data-slot={SLOT.GROUP}
      className={cn(AVATAR_STYLES.group, className)}
      {...props}
    />
  )
}
