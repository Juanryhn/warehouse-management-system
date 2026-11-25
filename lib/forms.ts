import { ZodError } from "zod";
import { AuthError } from "@/lib/auth/session";

export type { FormState } from "./forms/shared";
export { EMPTY_FORM_STATE, safeNextPath } from "./forms/shared";

import type { FormState } from "./forms/shared";

export const toFormState = (error: unknown): FormState => {
  if (error instanceof AuthError) return { error: error.message };

  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.issues) {
      const field = issue.path[0];
      if (typeof field === "string" && !fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return { error: "Check the highlighted fields.", fieldErrors };
  }

  const mongoError = error as { code?: number; keyPattern?: Record<string, unknown> };
  if (mongoError?.code === 11000) {
    const field = Object.keys(mongoError.keyPattern ?? {})[0]?.replace(/^./, (char) => char.toUpperCase());
    return {
      error: `${field ?? "This value"} is already in use.`,
      fieldErrors: field ? { [field.charAt(0).toLowerCase() + field.slice(1)]: "Already in use" } : undefined,
    };
  }

  console.error("Unhandled form error", error);
  return { error: "Something went wrong. Please try again." };
};
