import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { ComponentProps } from "react";
import type { Size } from "./constants";

export interface AvatarProps extends ComponentProps<
  typeof AvatarPrimitive.Root
> {
  size?: Size;
}
export type AvatarImageProps = ComponentProps<
  typeof AvatarPrimitive.Image
>;
export type AvatarFallbackProps = ComponentProps<
  typeof AvatarPrimitive.Fallback
>;
export type AvatarBadgeProps = ComponentProps<"span">;
export type AvatarGroupProps = ComponentProps<"div">;
export type AvatarGroupCountProps = ComponentProps<"div">;
