"use client";

import { createContext, useContext } from "react";
import { useFormContext, useFormState } from "react-hook-form";
import { FORM_ERRORS, FORM_IDS } from "../constants";
import { FormFieldContextValue, FormItemContextValue } from "../type";

export const FormFieldContext = createContext<FormFieldContextValue>(
  {} as FormFieldContextValue
);

export const FormItemContext = createContext<FormItemContextValue>(
  {} as FormItemContextValue
);

export const useFormField = () => {
  const fieldContext = useContext(FormFieldContext);
  const itemContext = useContext(FormItemContext);
  const { getFieldState } = useFormContext();
  const formState = useFormState({ name: fieldContext.name });
  const fieldState = getFieldState(fieldContext.name, formState);

  if (!fieldContext) {
    throw new Error(FORM_ERRORS.USE_FORM_FIELD);
  }

  const { id } = itemContext;

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}${FORM_IDS.ITEM}`,
    formDescriptionId: `${id}${FORM_IDS.DESCRIPTION}`,
    formMessageId: `${id}${FORM_IDS.MESSAGE}`,
    ...fieldState,
  };
};
