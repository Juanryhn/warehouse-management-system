"use server";

import { EMPTY_FORM_STATE, safeNextPath, toFormState, type FormState } from "@/lib/forms";
import { loginSchema } from "@/lib/validation";
import { clearRateLimit, isRateLimited } from "./rate-limit";
import { createSession, destroyCurrentSession, verifyCredentials } from "./session";

export const loginAction = async (_previous: FormState, formData: FormData): Promise<FormState> => {
  try {
    const input = loginSchema.parse({
      email: formData.get("email"),
      password: formData.get("password"),
      next: formData.get("next"),
    });
    const throttleKey = input.email.toLowerCase();
    if (isRateLimited(throttleKey)) return { error: "Too many attempts. Try again in 15 minutes." };

    const user = await verifyCredentials(input.email, input.password);
    if (!user) return { error: "Invalid email or password." };

    clearRateLimit(throttleKey);
    await createSession(user.id);
    return { ...EMPTY_FORM_STATE, redirectTo: safeNextPath(input.next) };
  } catch (error) {
    return toFormState(error);
  }
};

export const logoutAction = async (): Promise<void> => {
  await destroyCurrentSession();
};
