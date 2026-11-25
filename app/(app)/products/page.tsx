import Link from "next/link";
import { PageHeader, Badge } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { formatNumber } from "@/lib/format";
import { listCategories, listProducts } from "@/lib/modules/catalog/queries";

// This authenticated screen reads request-time session/stock data.
export const instant = false;

const inputClass =
  "h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-zinc-700 dark:bg-zinc-900";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const [result, categories] = await Promise.all([
    listProducts({ q: params.q, category: params.category, status: params.status, page, pageSize: 25 }),
    listCategories(),
  ]);

  const filterParams = {
    ...(params.q ? { q: params.q } : {}),
    ...(params.category ? { category: params.category } : {}),
    ...(params.status ? { status: params.status } : {}),
  };

  return (
    <>
      <PageHeader
        title="Products"
        description="SKUs, units and minimum stock levels. Archived products keep their history."
        actions={
          <>
            <Link href="/products/import" className="h-10 inline-flex items-center rounded-lg border border-zinc-300 px-4 text-sm font-medium transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
              Import CSV
            </Link>
            <Link href="/products/new" className="h-10 inline-flex items-center rounded-lg bg-amber-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-amber-400">
              New product
            </Link>
          </>
        }
      />

      <form method="get" className="mb-5 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Search</span>
          <input name="q" defaultValue={params.q} placeholder="SKU or name" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Category</span>
          <select name="category" defaultValue={params.category ?? ""} className={inputClass}>
            <option value="">All</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Status</span>
          <select name="status" defaultValue={params.status ?? ""} className={inputClass}>
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <button type="submit" className="h-10 rounded-lg border border-zinc-300 px-4 text-sm font-medium transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
          Apply
        </button>
      </form>

      <DataTable
        rows={result.rows}
        rowKey={(row) => row.id}
        empty="No products match these filters."
        columns={[
          { key: "sku", label: "SKU", render: (row) => <span className="font-mono text-xs text-zinc-500">{row.sku}</span> },
          { key: "name", label: "Product", render: (row) => (
            <Link href={`/products/${row.id}`} className="font-medium text-zinc-900 hover:text-amber-600 dark:text-zinc-50">{row.name}</Link>
          ) },
          { key: "category", label: "Category", render: (row) => row.category },
          { key: "uom", label: "UoM", render: (row) => row.uom },
          { key: "onHand", label: "On hand", className: "text-right", render: (row) => formatNumber(row.onHand) },
          { key: "min", label: "Minimum", className: "text-right", render: (row) => formatNumber(row.minStock) },
          { key: "status", label: "Status", render: (row) => <Badge value={row.isActive ? "active" : "inactive"} /> },
        ]}
      />
      <Pagination page={page} pageSize={25} total={result.total} basePath="/products" params={filterParams} />
    </>
  );
}
