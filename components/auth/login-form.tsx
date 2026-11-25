"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { loginAction } from "@/lib/auth/actions";
import { DEMO_ACCOUNTS } from "@/lib/auth/demo";
import { EMPTY_FORM_STATE, safeNextPath } from "@/lib/forms/shared";

const inputClassName = (invalid: boolean): string =>
  [
    "h-11 w-full rounded-lg border bg-white px-3.5 text-sm text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500",
    invalid
      ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 dark:border-red-500/70"
      : "border-zinc-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/25 dark:border-zinc-700",
  ].join(" ");

export const LoginForm = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [state, formAction, isPending] = useActionState(loginAction, EMPTY_FORM_STATE);

  useEffect(() => {
    if (state.redirectTo) router.replace(state.redirectTo);
  }, [state.redirectTo, router]);

  return (
    <>
      <form action={formAction} noValidate className="mt-8 space-y-5">
        <input type="hidden" name="next" value={next} />
        {state.error ? (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400"
          >
            {state.error}
          </div>
        ) : null}

        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={Boolean(state.fieldErrors?.email)}
            placeholder="you@warehouse.test"
            className={inputClassName(Boolean(state.fieldErrors?.email))}
          />
          {state.fieldErrors?.email ? (
            <p className="text-xs text-red-600 dark:text-red-400">{state.fieldErrors.email}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={Boolean(state.fieldErrors?.password)}
              placeholder="Enter your password"
              className={`${inputClassName(Boolean(state.fieldErrors?.password))} pr-11`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-zinc-400 transition hover:text-zinc-600 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-amber-500 dark:hover:text-zinc-200"
            >
              {showPassword ? <EyeOffIcon className="size-5" /> : <EyeIcon className="size-5" />}
            </button>
          </div>
          {state.fieldErrors?.password ? (
            <p className="text-xs text-red-600 dark:text-red-400">{state.fieldErrors.password}</p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-amber-500 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-amber-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="mt-8 rounded-xl border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
          Seeded demo accounts
        </p>
        <ul className="mt-3 grid gap-1 sm:grid-cols-2">
          {DEMO_ACCOUNTS.map((account) => (
            <li key={account.email}>
              <button
                type="button"
                onClick={() => {
                  setEmail(account.email);
                  setPassword(account.password);
                }}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left transition hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber-500 dark:hover:bg-zinc-900"
              >
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">{account.label}</span>
                <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">{account.email}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
};

const EyeIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden className={className}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" strokeLinejoin="round" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden className={className}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" strokeLinejoin="round" />
    <circle cx="12" cy="12" r="3" />
    <path d="m4 4 16 16" strokeLinecap="round" />
  </svg>
);
