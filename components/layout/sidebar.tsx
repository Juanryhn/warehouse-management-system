"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark } from "@/components/logo-mark";

const GROUPS = [
  {
    label: "Overview",
    links: [
      { href: "/", label: "Dashboard" },
      { href: "/inventory", label: "Inventory" },
      { href: "/reports", label: "Reports" },
    ],
  },
  {
    label: "Operations",
    links: [
      { href: "/inbound", label: "Inbound" },
      { href: "/outbound", label: "Outbound" },
      { href: "/counts", label: "Cycle counts" },
    ],
  },
  {
    label: "Master data",
    links: [
      { href: "/products", label: "Products" },
      { href: "/locations", label: "Locations" },
      { href: "/settings", label: "Settings" },
    ],
  },
];

export const Sidebar = () => {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 md:flex">
      <div className="flex h-16 items-center gap-2.5 border-b border-zinc-200 px-5 dark:border-zinc-800">
        <LogoMark className="size-6 text-amber-500" />
        <span className="text-sm font-semibold tracking-[0.18em] text-zinc-900 dark:text-zinc-50">WMS</span>
      </div>
      <nav aria-label="Main navigation" className="flex-1 space-y-6 overflow-y-auto px-3 py-6">
        {GROUPS.map((group) => (
          <div key={group.label}>
            <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.links.map((link) => {
                const active =
                  link.href === "/" ? pathname === "/" : pathname === link.href || pathname.startsWith(`${link.href}/`);
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      aria-current={active ? "page" : undefined}
                      className={`block rounded-lg px-2.5 py-2 text-sm transition focus-visible:outline-2 focus-visible:outline-amber-500 ${
                        active
                          ? "bg-amber-500/10 font-semibold text-amber-700 dark:text-amber-400"
                          : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      }`}
                    >
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-zinc-200 px-5 py-4 text-[11px] text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        Local replica-set mode
      </div>
    </aside>
  );
};
