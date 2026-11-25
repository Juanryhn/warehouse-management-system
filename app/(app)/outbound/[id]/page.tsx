import { notFound } from "next/navigation";
import { AutoForm, type FormField } from "@/components/ui/auto-form";
import { Badge, PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { formatDate, formatNumber } from "@/lib/format";
import { getProductOptions } from "@/lib/modules/catalog/queries";
import {
  addOrderLineAction,
  allocateOrderAction,
  cancelOrderAction,
  packOrderAction,
  pickOrderAction,
  shipOrderAction,
} from "@/lib/modules/outbound/actions";
import { getOrder } from "@/lib/modules/outbound/queries";

// This authenticated screen reads request-time session/stock data.
export const instant = false;

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [order, products] = await Promise.all([getOrder(id), getProductOptions()]);
  if (!order) notFound();

  const orderField: FormField[] = [{ name: "orderId", label: "Order", type: "hidden", defaultValue: order.id }];
  const addFields: FormField[] = [
    { name: "orderId", label: "Order", type: "hidden", defaultValue: order.id },
    { name: "productId", label: "Product", type: "select", required: true, options: products },
    { name: "ordered", label: "Quantity", type: "number", min: 1, required: true },
  ];
  const lineFields = (lineId: string): FormField[] => [
    { name: "orderId", label: "Order", type: "hidden", defaultValue: order.id },
    { name: "lineId", label: "Line", type: "hidden", defaultValue: lineId },
  ];

  return (
    <>
      <PageHeader
        title={order.number}
        description={`${order.customer} · created ${formatDate(order.createdAt)}`}
        actions={<Badge value={order.status} />}
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <DataTable
            rows={order.lines}
            rowKey={(row) => row.id}
            empty="This order has no lines."
            columns={[
              { key: "product", label: "Product", render: (row) => row.product },
              { key: "ordered", label: "Ordered", className: "text-right", render: (row) => formatNumber(row.ordered) },
              { key: "allocated", label: "Allocated", className: "text-right", render: (row) => formatNumber(row.allocated) },
              { key: "picked", label: "Picked", className: "text-right", render: (row) => formatNumber(row.picked) },
              { key: "backorder", label: "Backorder", className: "text-right", render: (row) => (
                row.backorder > 0 ? <span className="font-semibold text-amber-600 dark:text-amber-400">{formatNumber(row.backorder)}</span> : "—"
              ) },
              { key: "actions", label: "Actions", render: (row) => (
                <div className="flex flex-wrap gap-2">
                  {order.status === "draft" || order.status === "allocated" ? (
                    <AutoForm action={allocateOrderAction} fields={lineFields(row.id)} submitLabel="Allocate" />
                  ) : null}
                  {order.status === "allocated" || order.status === "picked" ? (
                    <AutoForm action={pickOrderAction} fields={lineFields(row.id)} submitLabel="Pick" />
                  ) : null}
                </div>
              ) },
            ]}
          />
          <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Pick list (grouped by bin)</h2>
            <ul className="space-y-2 text-sm">
              {order.lines.flatMap((line) => line.allocations.map((allocation) => (
                <li key={`${line.id}-${allocation.locationId}`} className="flex justify-between gap-4 border-b border-zinc-100 py-1.5 last:border-0 dark:border-zinc-800">
                  <span>{line.product}</span>
                  <span className="font-mono text-xs">{allocation.bin}</span>
                  <span>{formatNumber(allocation.quantity)} · picked {formatNumber(allocation.picked)}</span>
                </li>
              )))}
              {order.lines.every((line) => line.allocations.length === 0) ? (
                <li className="text-zinc-500">Nothing allocated yet.</li>
              ) : null}
            </ul>
          </div>
        </div>
        <div className="space-y-5">
          {order.status === "draft" ? (
            <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Add line</h2>
              <AutoForm action={addOrderLineAction} fields={addFields} submitLabel="Add line" />
            </div>
          ) : null}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Fulfilment</h2>
            <div className="space-y-3">
              {order.status === "picked" ? <AutoForm action={packOrderAction} fields={orderField} submitLabel="Pack order" /> : null}
              {order.status === "packed" ? <AutoForm action={shipOrderAction} fields={orderField} submitLabel="Ship order" /> : null}
              {!["shipped", "cancelled"].includes(order.status) ? (
                <AutoForm action={cancelOrderAction} fields={orderField} submitLabel="Cancel order" />
              ) : null}
              {["shipped", "cancelled"].includes(order.status) ? (
                <p className="text-sm text-zinc-500">This order is closed.</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
