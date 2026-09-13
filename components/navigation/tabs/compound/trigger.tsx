
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib";
import { TABS_STYLES } from "../variable";
import { TabsTriggerProps, TabsSize } from "../type";
import { SLOT, DEFAULT } from "../constants";

export function Trigger({
  className,
  size = DEFAULT.SIZE,
  ...props
}: TabsTriggerProps) {
  return (
    <TabsPrimitive.Trigger
      data-slot={SLOT.TRIGGER}
      data-size={size}
      className={cn(
        TABS_STYLES.trigger.base,
        TABS_STYLES.trigger.size[size as TabsSize],
        className,
      )}
      {...props}
    />
  );
}
