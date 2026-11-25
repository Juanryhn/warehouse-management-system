import Link from "next/link";
import { AutoForm, type FormField } from "@/components/ui/auto-form";
import { PageHeader, Badge } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { formatNumber } from "@/lib/format";
import { createOrderAction } from "@/lib/modules/outbound/actions";
import { getCustomerOptions, listOrders } from "@/lib/modules/outbound/queries";
import { getProductOptions } from "@/lib/modules/catalog/queries";

// This authenticated screen reads request-time session/stock data.
export const instant = false;

export default async function OutboundPage() {
  const [rows, products, customers] = await Promise.all([
    listOrders(),
    getProductOptions(),
    getCustomerOptions(),
  ]);

  const fields: FormField[] = [
    { name: "customer", label: "Customer", type: "select", required: true, options: customers },
    { name: "productId", label: "First product", type: "select", required: true, options: products },
    { name: "ordered", label: "Ordered quantity", type: "number", min: 1, required: true },
  ];

  return (
    <>
      <PageHeader title="Outbound" description="Allocate stock, pick by bin, pack, then ship." />
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <DataTable
          rows={rows}
          rowKey={(row) => row.id}
          empty="No orders yet. Create the first one."
          columns={[
            { key: "number", label: "Order", render: (row) => (
              <Link href={`/outbound/${row.id}`} className="font-mono text-sm font-medium text-zinc-900 hover:text-amber-600 dark:text-zinc-50">{row.number}</Link>
            ) },
            { key: "customer", label: "Customer", render: (row) => row.customer },
            { key: "ordered", label: "Ordered", className: "text-right", render: (row) => formatNumber(row.ordered) },
            { key: "allocated", label: "Allocated", className: "text-right", render: (row) => formatNumber(row.allocated) },
            { key: "status", label: "Status", render: (row) => <Badge value={row.status} /> },
            { key: "created", label: "Created", render: (row) => <span className="text-xs text-zinc-500">{row.createdAt}</span> },
          ]}
        />
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">New order</h2>
          <AutoForm action={createOrderAction} fields={fields} submitLabel="Create order" />
        </div>
      </div>
    </>
  );
}
