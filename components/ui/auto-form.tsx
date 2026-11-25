"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { FormState } from "@/lib/forms/shared";

export type FormField = {
  name: string;
  label: string;
  type?: "text" | "number" | "select" | "textarea" | "hidden";
  options?: { value: string; label: string }[];
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  min?: number;
  helper?: string;
  full?: boolean;
};

type AutoFormProps = {
  action: (previous: FormState, formData: FormData) => Promise<FormState>;
  fields: FormField[];
  submitLabel?: string;
  cancelHref?: string;
};

const controlClass = (invalid: boolean): string =>
  [
    "h-10 w-full rounded-lg border bg-white px-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:ring-2 dark:bg-zinc-900 dark:text-zinc-50",
    invalid
      ? "border-red-400 focus:border-red-500 focus:ring-red-500/20"
      : "border-zinc-300 focus:border-amber-500 focus:ring-amber-500/20 dark:border-zinc-700",
  ].join(" ");

export const AutoForm = ({ action, fields, submitLabel = "Save", cancelHref }: AutoFormProps) => {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(action, {});

  useEffect(() => {
    if (state.redirectTo) router.replace(state.redirectTo);
  }, [state.redirectTo, router]);

  return (
    <form action={formAction} noValidate className="space-y-4">
      {state.error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400"
        >
          {state.error}
        </div>
      ) : null}
      {state.notice ? (
        <div
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400"
        >
          {state.notice}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((field) => {
          if (field.type === "hidden") {
            return <input key={field.name} type="hidden" name={field.name} defaultValue={field.defaultValue} />;
          }

          const invalid = Boolean(state.fieldErrors?.[field.name]);
          return (
            <div key={field.name} className={field.full || field.type === "textarea" ? "sm:col-span-2" : ""}>
              <label htmlFor={field.name} className="mb-1.5 block text-sm font-medium text-zinc-800 dark:text-zinc-200">
                {field.label}
                {field.required ? <span className="ml-0.5 text-red-500">*</span> : null}
              </label>
              {field.type === "select" ? (
                <select
                  id={field.name}
                  name={field.name}
                  defaultValue={field.defaultValue ?? ""}
                  required={field.required}
                  aria-invalid={invalid}
                  className={controlClass(invalid)}
                >
                  <option value="">Select…</option>
                  {field.options?.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : field.type === "textarea" ? (
                <textarea
                  id={field.name}
                  name={field.name}
                  rows={3}
                  defaultValue={field.defaultValue}
                  placeholder={field.placeholder}
                  aria-invalid={invalid}
                  className={`${controlClass(invalid)} h-auto py-2`}
                />
              ) : (
                <input
                  id={field.name}
                  name={field.name}
                  type={field.type ?? "text"}
                  defaultValue={field.defaultValue}
                  placeholder={field.placeholder}
                  required={field.required}
                  min={field.min}
                  aria-invalid={invalid}
                  className={controlClass(invalid)}
                />
              )}
              {invalid ? (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{state.fieldErrors?.[field.name]}</p>
              ) : field.helper ? (
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{field.helper}</p>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={isPending}
          className="h-10 rounded-lg bg-amber-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 disabled:opacity-60"
        >
          {isPending ? "Saving…" : submitLabel}
        </button>
        {cancelHref ? (
          <a
            href={cancelHref}
            className="h-10 inline-flex items-center rounded-lg border border-zinc-300 px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Cancel
          </a>
        ) : null}
      </div>
    </form>
  );
};
