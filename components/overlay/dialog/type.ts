import * as DialogPrimitive from "@radix-ui/react-dialog";

export type DialogProps = React.ComponentProps<
  typeof DialogPrimitive.Root
>;
export type DialogTriggerProps = React.ComponentProps<
  typeof DialogPrimitive.Trigger
>;
export type DialogPortalProps = React.ComponentProps<
  typeof DialogPrimitive.Portal
>;
export type DialogCloseProps = React.ComponentProps<
  typeof DialogPrimitive.Close
>;
export type DialogOverlayProps = React.ComponentProps<
  typeof DialogPrimitive.Overlay
>;
export interface DialogContentProps extends React.ComponentProps<
  typeof DialogPrimitive.Content
> {
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
}
export type DialogHeaderProps = React.ComponentProps<"div">;
export interface DialogFooterProps extends React.ComponentProps<"div"> {
  showCloseButton?: boolean;
}
export type DialogTitleProps = React.ComponentProps<
  typeof DialogPrimitive.Title
>;
export type DialogDescriptionProps = React.ComponentProps<
  typeof DialogPrimitive.Description
>;
