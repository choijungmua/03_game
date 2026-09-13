"use client";

import { useState } from "react";
import { cn } from "@/lib";
import { PasswordActions } from "./_components";
import { inputVariants, INPUT_STYLES } from "./variable";
import { InputProps } from "./type";
import { SLOT, INPUT_TYPES } from "./constants";

function Input({
  className,
  type,
  variant,
  size,
  shape,
  leftIcon,
  rightIcon,
  value,
  onChange,
  ...props
}: InputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === INPUT_TYPES.PASSWORD;
  const currentType = isPassword ? (showPassword ? INPUT_TYPES.TEXT : INPUT_TYPES.PASSWORD) : type;

  const handleClear = () => {
    if (onChange) {
      const event = {
        target: { value: "" },
        currentTarget: { value: "" },
      } as React.ChangeEvent<HTMLInputElement>;
      onChange(event);
    }
  };

  const hasValue = value !== undefined && value !== null && value !== "";

  const passwordActions = isPassword ? (
    <PasswordActions
      showPassword={showPassword}
      onTogglePassword={() => setShowPassword(!showPassword)}
      hasValue={hasValue}
      onClear={handleClear}
    />
  ) : null;

  const finalRightIcon = rightIcon || passwordActions;
  const hasIcon = !!leftIcon || !!finalRightIcon;

  const inputElement = (
    <input
      type={currentType}
      value={value}
      onChange={onChange}
      data-slot={SLOT.ROOT}
      className={cn(
        inputVariants({ variant, size, shape }),
        leftIcon && "pl-10",
        finalRightIcon && "pr-16",
        "peer",
        className,
      )}
      {...props}
    />
  );

  if (!hasIcon) {
    return inputElement;
  }

  return (
    <div className="relative w-full">
      {leftIcon && (
        <span className={cn(INPUT_STYLES.icon, "left-3")}>
          {leftIcon}
        </span>
      )}
      {inputElement}
      {finalRightIcon && (
        <span className={cn(INPUT_STYLES.icon, "right-3")}>
          {finalRightIcon}
        </span>
      )}
    </div>
  );
}

export { Input };
