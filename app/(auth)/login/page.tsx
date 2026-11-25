import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { LogoMark } from "@/components/logo-mark";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-slate-950 p-12 text-slate-100 lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,.04)_1px,transparent_1px),linear-gradient(rgba(255,255,255,.04)_1px,transparent_1px)] bg-[size:32px_32px]"
        />
        <div className="relative flex items-center gap-3">
          <LogoMark className="size-9 text-amber-400" />
          <span className="text-lg font-semibold tracking-[0.18em]">WMS</span>
        </div>
        <div className="relative max-w-lg">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-400">
            Warehouse operations
          </p>
          <h2 className="mt-4 text-4xl font-semibold leading-tight tracking-tight">
            Every pallet, accounted for.
          </h2>
          <p className="mt-5 text-sm leading-7 text-slate-400">
            Receive stock, put it away, pick orders, and reconcile bins. Every quantity change is recorded
            with its document, reason, and operator.
          </p>
        </div>
        <p className="relative text-xs text-slate-500">Internal use only · Sessions expire after 7 days</p>
      </section>

      <section className="flex items-center justify-center bg-zinc-50 px-5 py-12 dark:bg-zinc-950 sm:px-10">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2.5 lg:hidden">
            <LogoMark className="size-8 text-amber-500" />
            <span className="text-base font-semibold tracking-[0.18em] text-zinc-900 dark:text-zinc-50">WMS</span>
          </div>
          <h1 className="mt-8 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 lg:mt-0">
            Sign in
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Use your warehouse account to continue.</p>
          <Suspense fallback={<div className="mt-8 h-80 animate-pulse rounded-xl bg-zinc-200/60 dark:bg-zinc-800/60" />}>
            <LoginForm />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
