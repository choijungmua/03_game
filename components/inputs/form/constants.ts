export const FORM_SLOTS = {
  ITEM: "form-item",
  LABEL: "form-label",
  CONTROL: "form-control",
  TIP: "form-tip",
  MESSAGE: "form-message",
} as const;

export const FORM_IDS = {
  ITEM: "-form-item",
  DESCRIPTION: "-form-item-description",
  MESSAGE: "-form-item-message",
} as const;

export const FORM_ERRORS = {
  USE_FORM_FIELD: "useFormField should be used within <FormField>",
} as const;
