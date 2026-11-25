import { AutoForm, type FormField } from "@/components/ui/auto-form";
import { PageHeader, Badge } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import Link from "next/link";
import { formatNumber } from "@/lib/format";
import { createReceiptAction } from "@/lib/modules/inbound/actions";
import { getSupplierOptions, listReceipts } from "@/lib/modules/inbound/queries";
import { getProductOptions } from "@/lib/modules/catalog/queries";

// This authenticated screen reads request-time session/stock data.
export const instant = false;

export default async function InboundPage() {
  const [rows, products, suppliers] = await Promise.all([
    listReceipts(),
    getProductOptions(),
    getSupplierOptions(),
  ]);

  const fields: FormField[] = [
    { name: "supplier", label: "Supplier", type: "select", required: true, options: suppliers },
    { name: "productId", label: "First product", type: "select", required: true, options: products },
    { name: "expected", label: "Expected quantity", type: "number", min: 1, required: true },
  ];

  return (
    <>
      <PageHeader title="Inbound" description="Create a receipt, receive partial quantities into bins, then post." />
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <DataTable
          rows={rows}
          rowKey={(row) => row.id}
          empty="No receipts yet. Create the first one."
          columns={[
            { key: "number", label: "Receipt", render: (row) => (
              <Link href={`/inbound/${row.id}`} className="font-mono text-sm font-medium text-zinc-900 hover:text-amber-600 dark:text-zinc-50">{row.number}</Link>
            ) },
            { key: "supplier", label: "Supplier", render: (row) => row.supplier },
            { key: "expected", label: "Expected", className: "text-right", render: (row) => formatNumber(row.expected) },
            { key: "received", label: "Received", className: "text-right", render: (row) => formatNumber(row.received) },
            { key: "status", label: "Status", render: (row) => <Badge value={row.status} /> },
            { key: "created", label: "Created", render: (row) => <span className="text-xs text-zinc-500">{row.createdAt}</span> },
          ]}
        />
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">New receipt</h2>
          <AutoForm action={createReceiptAction} fields={fields} submitLabel="Create receipt" />
        </div>
      </div>
    </>
  );
}
