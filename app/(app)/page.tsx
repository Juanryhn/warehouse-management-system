import Link from "next/link";
import { getKpis } from "@/lib/modules/dashboard/queries";
import { formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";

// This authenticated screen reads request-time session/stock data.
export const instant = false;

const CARDS = [
  { key: "skuCount", label: "Active SKUs", href: "/products", description: "Catalog items ready to use" },
  { key: "lowStock", label: "Low stock", href: "/inventory?view=low", description: "Below minimum stock level" },
  { key: "openReceipts", label: "Open receipts", href: "/reports?report=receipts", description: "Inbound documents in progress" },
  { key: "openOrders", label: "Open orders", href: "/reports?report=orders", description: "Outbound documents in progress" },
  { key: "movementsToday", label: "Movements today", href: "/reports?report=movements", description: "Stock changes recorded today" },
] as const;

export default async function DashboardPage() {
  const kpis = await getKpis();

  return (
    <>
      <PageHeader title="Dashboard" description="Today at a glance across the warehouse." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((card) => (
          <Link
            key={card.key}
            href={card.href}
            className="group rounded-xl border border-zinc-200 bg-white p-5 transition hover:border-amber-400 focus-visible:outline-2 focus-visible:outline-amber-500 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{card.label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              {formatNumber(kpis[card.key])}
            </p>
            <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">{card.description}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
