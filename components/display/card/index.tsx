import {
  Root,
  Header,
  Title,
  Description,
  Action,
  Content,
  Footer,
} from "./compound"

export const Card = Object.assign(Root, {
  Header,
  Title,
  Description,
  Action,
  Content,
  Footer,
})

export type {
  CardProps,
  CardHeaderProps,
  CardTitleProps,
  CardDescriptionProps,
  CardActionProps,
  CardContentProps,
  CardFooterProps,
} from "./type"
export { CARD_STYLES } from "./variable"
