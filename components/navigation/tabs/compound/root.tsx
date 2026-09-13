
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib";
import { TABS_STYLES } from "../variable";
import { TabsProps } from "../type";
import { SLOT, DEFAULT } from "../constants";

export function Root({
  className,
  orientation = DEFAULT.ORIENTATION,
  size = DEFAULT.SIZE,
  ...props
}: TabsProps) {
  return (
    <TabsPrimitive.Root
      data-slot={SLOT.ROOT}
      data-orientation={orientation}
      data-size={size}
      orientation={orientation}
      className={cn(TABS_STYLES.root, className)}
      {...props}
    />
  );
}
