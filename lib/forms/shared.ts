export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  notice?: string;
  redirectTo?: string;
};

export const EMPTY_FORM_STATE: FormState = {};

export const safeNextPath = (value: unknown): string => {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return "/";
  }
  return value;
};
