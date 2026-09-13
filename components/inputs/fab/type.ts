import { type VariantProps } from "class-variance-authority"
import { buttonVariants } from "@/components"

export interface FabProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  ref?: React.Ref<HTMLDivElement>
  asChild?: boolean
  position?: "bottom-right" | "bottom-left" | "bottom-center"
}
