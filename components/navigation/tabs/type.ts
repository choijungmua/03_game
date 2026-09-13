import * as TabsPrimitive from "@radix-ui/react-tabs";
import { type VariantProps } from "class-variance-authority";
import { tabsListVariants } from "./variable";

export type TabsSize = "sm" | "default" | "lg";
export type TabsVariant = "default" | "line";

export type TabsProps = {
  size?: TabsSize;
} & React.ComponentProps<typeof TabsPrimitive.Root>;

export interface TabsListProps
  extends React.ComponentProps<typeof TabsPrimitive.List>,
    VariantProps<typeof tabsListVariants> {
  indicatorColor?: string;
}

export type TabsTriggerProps = {
  size?: TabsSize;
  variant?: TabsVariant;
} & React.ComponentProps<typeof TabsPrimitive.Trigger>;

export type TabsContentProps = React.ComponentProps<typeof TabsPrimitive.Content>;
