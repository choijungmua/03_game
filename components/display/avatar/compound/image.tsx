
import * as AvatarPrimitive from "@radix-ui/react-avatar"
import { cn } from "@/lib"
import { AVATAR_STYLES } from "../variable"
import { AvatarImageProps } from "../type"
import { SLOT } from "../constants"

export function Image({
  className,
  ...props
}: AvatarImageProps) {
  return (
    <AvatarPrimitive.Image
      data-slot={SLOT.IMAGE}
      className={cn(AVATAR_STYLES.image, className)}
      {...props}
    />
  )
}
