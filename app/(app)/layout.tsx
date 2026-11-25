import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";

// Every screen in this group reads the session and live stock at request time.
// The shell still streams through Suspense; only instant-navigation validation is skipped.
export const instant = false;

export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
