import Link from "next/link";
import { PageHeader, Badge } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { formatNumber } from "@/lib/format";
import { listStock } from "@/lib/modules/inventory/queries";

// This authenticated screen reads request-time session/stock data.
export const instant = false;

const inputClass =
  "h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-zinc-700 dark:bg-zinc-900";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; view?: string }>;
}) {
  const params = await searchParams;
  const rows = await listStock({ q: params.q, view: params.view });

  return (
    <>
      <PageHeader
        title="Inventory"
        description="On hand, reserved and available quantity for every product/bin pair."
        actions={
          <Link href="/inventory/adjustments" className="h-10 inline-flex items-center rounded-lg border border-zinc-300 px-4 text-sm font-medium transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
            Adjustments
          </Link>
        }
      />
      <form method="get" className="mb-5 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Search</span>
          <input name="q" defaultValue={params.q} placeholder="SKU, product or bin" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">View</span>
          <select name="view" defaultValue={params.view ?? ""} className={inputClass}>
            <option value="">All stock</option>
            <option value="low">Low stock only</option>
          </select>
        </label>
        <button type="submit" className="h-10 rounded-lg border border-zinc-300 px-4 text-sm font-medium transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">Apply</button>
      </form>
      <DataTable
        rows={rows}
        rowKey={(row) => row.id}
        empty="No stock rows match these filters."
        columns={[
          { key: "sku", label: "SKU", render: (row) => <span className="font-mono text-xs text-zinc-500">{row.sku}</span> },
          { key: "product", label: "Product", render: (row) => (
            <Link href={`/inventory/${row.productId}`} className="font-medium text-zinc-900 hover:text-amber-600 dark:text-zinc-50">{row.product}</Link>
          ) },
          { key: "bin", label: "Bin", render: (row) => <span className="font-mono text-xs">{row.bin}</span> },
          { key: "onHand", label: "On hand", className: "text-right", render: (row) => formatNumber(row.onHand) },
          { key: "reserved", label: "Reserved", className: "text-right", render: (row) => formatNumber(row.reserved) },
          { key: "available", label: "Available", className: "text-right", render: (row) => <span className="font-semibold">{formatNumber(row.available)}</span> },
          { key: "state", label: "State", render: (row) => <Badge value={row.onHand < row.minStock ? "pending" : "active"} /> },
        ]}
      />
    </>
  );
}
