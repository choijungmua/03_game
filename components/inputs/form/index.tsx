import {
  Root,
  Field,
  Item,
  Label,
  Control,
  Tip,
  Message,
} from "./compound";
import { Input } from "../input";
import { Button } from "../button";
import { Checkbox } from "../checkbox";

export const Form = Object.assign(Root, {
  Field,
  Item,
  Label,
  Control,
  Tip,
  Message,
  Input,
  Button,
  Checkbox,
});

export { useFormField } from "./compound";
export * from "./type";
export * from "./variable";