import Link from "next/link";
import { AutoForm, type FormField } from "@/components/ui/auto-form";
import { PageHeader, Badge } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { formatNumber } from "@/lib/format";
import { createCountAction } from "@/lib/modules/counts/actions";
import { listCounts } from "@/lib/modules/counts/queries";
import { getLocationOptions, getZoneOptions } from "@/lib/modules/locations/queries";

// This authenticated screen reads request-time session/stock data.
export const instant = false;

export default async function CountsPage() {
  const [rows, bins, zones] = await Promise.all([
    listCounts(),
    getLocationOptions(),
    getZoneOptions(),
  ]);

  const binFields: FormField[] = [
    { name: "scopeType", label: "Scope", type: "hidden", defaultValue: "bin" },
    { name: "scopeValue", label: "Bin", type: "select", required: true, options: bins },
  ];
  const zoneFields: FormField[] = [
    { name: "scopeType", label: "Scope", type: "hidden", defaultValue: "zone" },
    { name: "scopeValue", label: "Zone", type: "select", required: true, options: zones },
  ];

  return (
    <>
      <PageHeader title="Cycle counts" description="Snapshot expected stock, count a bin or zone, then approve the variance." />
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <DataTable
          rows={rows}
          rowKey={(row) => row.id}
          empty="No cycle counts yet. Start one from the right."
          columns={[
            { key: "number", label: "Count", render: (row) => (
              <Link href={`/counts/${row.id}`} className="font-mono text-sm font-medium text-zinc-900 hover:text-amber-600 dark:text-zinc-50">{row.number}</Link>
            ) },
            { key: "scope", label: "Scope", render: (row) => row.scope },
            { key: "lines", label: "Lines", className: "text-right", render: (row) => formatNumber(row.lines) },
            { key: "variance", label: "Variance", className: "text-right", render: (row) => (
              <span className={row.variance !== 0 ? "font-semibold text-amber-600 dark:text-amber-400" : ""}>
                {row.variance > 0 ? "+" : ""}{formatNumber(row.variance)}
              </span>
            ) },
            { key: "status", label: "Status", render: (row) => <Badge value={row.status} /> },
            { key: "created", label: "Created", render: (row) => <span className="text-xs text-zinc-500">{row.createdAt}</span> },
          ]}
        />
        <div className="space-y-5">
          <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Count a bin</h2>
            <AutoForm action={createCountAction} fields={binFields} submitLabel="Start bin count" />
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Count a zone</h2>
            <AutoForm action={createCountAction} fields={zoneFields} submitLabel="Start zone count" />
          </div>
        </div>
      </div>
    </>
  );
}
