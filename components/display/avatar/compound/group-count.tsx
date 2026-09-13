import { cn } from "@/lib"
import { AVATAR_STYLES } from "../variable"
import { AvatarGroupCountProps } from "../type"
import { SLOT } from "../constants"

export function GroupCount({
  className,
  ...props
}: AvatarGroupCountProps) {
  return (
    <div
      data-slot={SLOT.GROUP_COUNT}
      className={cn(AVATAR_STYLES.groupCount, className)}
      {...props}
    />
  )
}
