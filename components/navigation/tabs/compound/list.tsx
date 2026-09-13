
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib";
import { TABS_STYLES } from "../variable";
import { TabsListProps, TabsSize, TabsVariant } from "../type";
import { SLOT, DEFAULT } from "../constants";

export function List({
  className,
  variant = DEFAULT.VARIANT,
  size = DEFAULT.SIZE,
  indicatorColor,
  style,
  ...props
}: TabsListProps) {
  return (
    <TabsPrimitive.List
      data-slot={SLOT.LIST}
      data-variant={variant}
      data-size={size}
      className={cn(
        TABS_STYLES.list.base,
        TABS_STYLES.list.variant[variant as TabsVariant],
        TABS_STYLES.list.size[size as TabsSize],
        className,
      )}
      style={{
        ...style,
        ...(indicatorColor && { "--tabs-indicator-color": indicatorColor } as React.CSSProperties),
      }}
      {...props}
    />
  );
}
