import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";
import { logoutAction } from "@/lib/auth/actions";
import { getCurrentUser } from "@/lib/auth/session";
import { Badge } from "@/components/ui/page-header";
import { Sidebar } from "./sidebar";

const SidebarFallback = () => (
  <div className="hidden h-dvh w-60 shrink-0 border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 md:block" />
);

const HeaderFallback = () => (
  <div className="flex h-16 items-center justify-between border-b border-zinc-200 bg-white px-5 dark:border-zinc-800 dark:bg-zinc-900">
    <div className="h-4 w-28 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
    <div className="h-8 w-24 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
  </div>
);

const SessionContent = async ({ children }: { children: ReactNode }) => {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <>
      <header className="flex h-16 items-center justify-between gap-4 border-b border-zinc-200 bg-white px-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{user.name}</span>
          <Badge value={user.role} />
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="h-9 rounded-lg border border-zinc-300 px-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-amber-500 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Sign out
          </button>
        </form>
      </header>
      <main className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8">{children}</main>
    </>
  );
};

export const AppShell = ({ children }: { children: ReactNode }) => (
  <div className="flex min-h-dvh bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
    <Suspense fallback={<SidebarFallback />}>
      <Sidebar />
    </Suspense>
    <div className="flex min-w-0 flex-1 flex-col">
      <Suspense fallback={<HeaderFallback />}>
        <SessionContent>{children}</SessionContent>
      </Suspense>
    </div>
  </div>
);
