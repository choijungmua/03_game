import {
  Root,
  Image,
  Fallback,
  Badge,
  Group,
  GroupCount
} from "./compound"

export const Avatar = Object.assign(Root, {
  Image,
  Fallback,
  Badge,
  Group,
  GroupCount,
})

export type {
  AvatarProps,
  AvatarImageProps,
  AvatarFallbackProps,
  AvatarBadgeProps,
  AvatarGroupProps,
  AvatarGroupCountProps,
} from "./type"
export { AVATAR_STYLES } from "./variable"