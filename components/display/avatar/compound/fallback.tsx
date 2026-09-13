import * as AvatarPrimitive from "@radix-ui/react-avatar"
import { cn } from "@/lib"
import { AVATAR_STYLES } from "../variable"
import { AvatarFallbackProps } from "../type"
import { SLOT } from "../constants"

export function Fallback({
  className,
  ...props
}: AvatarFallbackProps) {
  return (
    <AvatarPrimitive.Fallback
      data-slot= {SLOT.FALLBACK}
      className={cn(AVATAR_STYLES.fallback, className)}
      {...props}
    />
  )
}
