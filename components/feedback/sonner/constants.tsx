import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { cn } from "@/lib";

export const SLOT = {
  TOASTER: "toaster",
  TOAST: "toast",
} as const;

const ICON_SIZE = "size-4";

// 반복되는 그룹 선택자 상수화
const GROUP_TOASTER = `group-[.${SLOT.TOASTER}]`;
const GROUP_TOAST = `group-[.${SLOT.TOAST}]`;

export const ICONS = {
  success: <CircleCheckIcon className={cn(ICON_SIZE, "text-success")} />,
  info: <InfoIcon className={cn(ICON_SIZE, "text-info")} />,
  warning: <TriangleAlertIcon className={cn(ICON_SIZE, "text-warning")} />,
  error: <OctagonXIcon className={cn(ICON_SIZE, "text-error")} />,
  loading: <Loader2Icon className={cn(ICON_SIZE, "animate-spin text-muted-foreground")} />,
};

export const TOAST_STYLES = {
  root: cn(
    "group",
    SLOT.TOAST,
    `${GROUP_TOASTER}:bg-background`,
    `${GROUP_TOASTER}:text-foreground`,
    `${GROUP_TOASTER}:border-border`,
    `${GROUP_TOASTER}:shadow-lg`
  ),
  description: `${GROUP_TOAST}:text-muted-foreground`,
  actionButton: `${GROUP_TOAST}:bg-primary ${GROUP_TOAST}:text-primary-foreground`,
  cancelButton: `${GROUP_TOAST}:bg-muted ${GROUP_TOAST}:text-muted-foreground`,
} as const;

export const TOAST_OPTIONS = {
  classNames: {
    toast: TOAST_STYLES.root,
    description: TOAST_STYLES.description,
    actionButton: TOAST_STYLES.actionButton,
    cancelButton: TOAST_STYLES.cancelButton,
  },
};
