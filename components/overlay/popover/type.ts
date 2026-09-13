import * as PopoverPrimitive from "@radix-ui/react-popover";

export type PopoverProps = React.ComponentProps<
  typeof PopoverPrimitive.Root
>;
export type PopoverTriggerProps = React.ComponentProps<
  typeof PopoverPrimitive.Trigger
>;
export type PopoverContentProps = React.ComponentProps<
  typeof PopoverPrimitive.Content
>;
export type PopoverAnchorProps = React.ComponentProps<
  typeof PopoverPrimitive.Anchor
>;
export type PopoverHeaderProps = React.ComponentProps<"div">;
export type PopoverTitleProps = React.ComponentProps<"h2">;
export type PopoverDescriptionProps = React.ComponentProps<"p">;
