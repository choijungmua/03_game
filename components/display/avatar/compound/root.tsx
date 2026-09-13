import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn } from "@/lib";
import { AVATAR_STYLES } from "../variable";
import { AvatarProps } from "../type";
import { SLOT } from "../constants";

export function Root({ className, size = "default", ...props }: AvatarProps) {
  return (
    <AvatarPrimitive.Root
        data-slot={SLOT.ROOT}
      data-size={size}
      className={cn(AVATAR_STYLES.root, className)}
      {...props}
    />
  );
}
