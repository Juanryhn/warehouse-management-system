import Link from "next/link";
import { PageHeader, Badge } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { listLocations } from "@/lib/modules/locations/queries";
import { formatNumber } from "@/lib/format";

// This authenticated screen reads request-time session/stock data.
export const instant = false;

const TYPES = ["receiving", "storage", "picking", "quarantine"] as const;

export default async function LocationsPage() {
  const rows = await listLocations();

  return (
    <>
      <PageHeader
        title="Locations"
        description="Warehouse bins and their stock. A bin with stock cannot be deactivated."
        actions={
          <>
            <Link href="/locations/labels" className="h-10 inline-flex items-center rounded-lg border border-zinc-300 px-4 text-sm font-medium transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
              Print labels
            </Link>
            <Link href="/locations/new" className="h-10 inline-flex items-center rounded-lg bg-amber-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-amber-400">
              New location
            </Link>
          </>
        }
      />
      <DataTable
        rows={rows}
        rowKey={(row) => row.id}
        empty="No locations yet."
        columns={[
          { key: "code", label: "Bin", render: (row) => (
            <Link href={`/locations/${row.id}`} className="font-mono text-sm font-medium text-zinc-900 hover:text-amber-600 dark:text-zinc-50">{row.code}</Link>
          ) },
          { key: "zone", label: "Zone", render: (row) => row.zone },
          { key: "type", label: "Type", render: (row) => row.type },
          { key: "products", label: "Products with stock", className: "text-right", render: (row) => formatNumber(row.products) },
          { key: "status", label: "Status", render: (row) => <Badge value={row.isActive ? "active" : "inactive"} /> },
        ]}
      />
      <p className="mt-4 text-xs text-zinc-400 dark:text-zinc-500">Types: {TYPES.join(" · ")}</p>
    </>
  );
}
