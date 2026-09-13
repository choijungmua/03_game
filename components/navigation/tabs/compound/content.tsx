
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib";
import { TABS_STYLES } from "../variable";
import { TabsContentProps } from "../type";
import { SLOT } from "../constants";

export function Content({ className, ...props }: TabsContentProps) {
  return (
    <TabsPrimitive.Content
      data-slot={SLOT.CONTENT}
      className={cn(TABS_STYLES.content, className)}
      {...props}
    />
  );
}
