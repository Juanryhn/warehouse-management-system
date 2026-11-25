import Link from "next/link";
import { hasCapability } from "@/lib/auth/authorize";
import { PageHeader } from "@/components/ui/page-header";
import { getSettings } from "@/lib/modules/settings/queries";

// This authenticated screen reads request-time session/stock data.
export const instant = false;

const LINKS = [
  { href: "/settings/users", label: "Users & roles", description: "Create users, reset passwords, deactivate accounts", capability: "manageUsers" },
  { href: "/settings/reference", label: "Reference data", description: "Suppliers, customers, reason codes and categories", capability: "manageCatalog" },
  { href: "/settings/audit", label: "Audit log", description: "Approvals, cancellations and configuration changes", capability: "export" },
] as const;

export default async function SettingsPage() {
  const [settings, allowed] = await Promise.all([
    getSettings(),
    Promise.all(LINKS.map((link) => hasCapability(link.capability))),
  ] as const);

  const config = [
    ["Database", settings.database],
    ["Database name", settings.databaseName],
    ["Session lifetime", `${settings.sessionDays} days`],
    ["Approval threshold", `${settings.approvalThreshold} units`],
    ["Demo seeding", settings.seeding],
    ["Display timezone", settings.timezone],
  ];

  return (
    <>
      <PageHeader title="Settings" description="Warehouse configuration and administrative tools." />
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Configuration</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Values are read from environment variables at startup. Restart the app after changing them.
          </p>
          <dl className="mt-5 divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
            {config.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 py-2.5">
                <dt className="text-zinc-500 dark:text-zinc-400">{label}</dt>
                <dd className="text-right font-medium text-zinc-900 dark:text-zinc-50">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Administration</h2>
          <ul className="mt-4 space-y-3">
            {LINKS.map((link, index) => (
              <li key={link.href}>
                {allowed[index] ? (
                  <Link
                    href={link.href}
                    className="block rounded-lg border border-zinc-200 px-4 py-3 transition hover:border-amber-400 hover:bg-amber-50/40 dark:border-zinc-800 dark:hover:bg-amber-500/10"
                  >
                    <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-50">{link.label}</span>
                    <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">{link.description}</span>
                  </Link>
                ) : (
                  <div className="rounded-lg border border-dashed border-zinc-200 px-4 py-3 opacity-60 dark:border-zinc-800">
                    <span className="block text-sm font-medium text-zinc-500 dark:text-zinc-400">{link.label}</span>
                    <span className="mt-0.5 block text-xs text-zinc-400 dark:text-zinc-500">Requires permission</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
