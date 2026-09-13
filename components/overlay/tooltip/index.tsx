import {
  Root,
  Provider,
  Trigger,
  Content,
} from "./compound";

export const Tooltip = Object.assign(Root, {
  Provider,
  Trigger,
  Content,
});

export * from "./variable";
export * from "./type";
