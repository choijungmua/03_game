import { Eye, EyeOff, X } from "lucide-react";
import { Button } from "@/components/inputs/button";
import { PasswordActionsProps } from "../type";

export function PasswordActions({
  showPassword,
  onTogglePassword,
  hasValue,
  onClear,
}: PasswordActionsProps) {
  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="xs"
        isIcon
        onClick={onTogglePassword}
        className="text-text-placeholder hover:text-text-alternative hover:bg-transparent"
      >
        {showPassword ? (
          <EyeOff className="size-3.5" />
        ) : (
          <Eye className="size-3.5" />
        )}
      </Button>
      {hasValue && (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          isIcon
          onClick={onClear}
          className="text-text-placeholder hover:text-text-alternative hover:bg-transparent"
        >
          <X className="size-3.5" />
        </Button>
      )}
    </div>
  );
}
