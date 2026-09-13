import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib";
import { Loading } from "@/components/feedback/loading";
import { buttonVariants } from "./variable";
import { ButtonProps } from "./type";
import { SLOT, BUTTON_VARIANTS } from "./constants";

function Button({
  className,
  variant = BUTTON_VARIANTS.DEFAULT,
  size = "default",
  shape,
  leftIcon,
  rightIcon,
  isLoading,
  disabled,
  isIcon,
  asChild = false,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";



  const isIconOnly = isIcon;
  const loader = <Loading size={16} variant={variant === BUTTON_VARIANTS.DEFAULT || variant === BUTTON_VARIANTS.DESTRUCTIVE ? "white" : "alternative"} />;

  return (
    <Comp
      data-slot={SLOT.ROOT}
      data-variant={variant}
      data-size={size}
      data-shape={shape}
      disabled={isLoading || disabled}
      className={cn(
        buttonVariants({ variant, size, shape, className }),
        "relative",
        isIcon && "px-0 aspect-square",
      )}
      {...props}
    >
      {isLoading && isIconOnly && (
        <span className="absolute inset-0 flex items-center justify-center">
          {loader}
        </span>
      )}

      {!isIconOnly && (isLoading || leftIcon) && (
        <span className="inline-flex shrink-0">
          {isLoading ? loader : leftIcon}
        </span>
      )}

      <span
        className={cn(
          "inline-flex items-center gap-2",
          isLoading && isIconOnly ? "invisible" : "",
        )}
      >
        {children}
      </span>

      {!isIconOnly && rightIcon && (
        <span className="inline-flex shrink-0">{rightIcon}</span>
      )}
    </Comp>
  );
}

export { Button };
