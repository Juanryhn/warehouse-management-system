import { notFound } from "next/navigation";
import { AutoForm, type FormField } from "@/components/ui/auto-form";
import { PageHeader, Badge } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { formatDate, formatNumber } from "@/lib/format";
import { getLocationOptions } from "@/lib/modules/locations/queries";
import { createAdjustmentAction, transferStockAction } from "@/lib/modules/inventory/actions";
import { getMovementCountForProduct, getStockCard } from "@/lib/modules/inventory/queries";

// This authenticated screen reads request-time session/stock data.
export const instant = false;

export default async function StockCardPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const [card, totals, locations] = await Promise.all([
    getStockCard(productId),
    getMovementCountForProduct(productId),
    getLocationOptions(),
  ]);
  if (!card) notFound();

  const adjustmentFields: FormField[] = [
    { name: "productId", label: "Product", type: "hidden", defaultValue: productId },
    { name: "locationId", label: "Bin", type: "select", required: true, options: locations },
    { name: "quantity", label: "Signed quantity", type: "number", required: true, helper: "Negative to decrease stock." },
    { name: "reasonCode", label: "Reason", required: true, placeholder: "Correction" },
  ];

  const transferFields: FormField[] = [
    { name: "productId", label: "Product", type: "hidden", defaultValue: productId },
    { name: "fromLocationId", label: "From bin", type: "select", required: true, options: locations },
    { name: "toLocationId", label: "To bin", type: "select", required: true, options: locations },
    { name: "quantity", label: "Quantity", type: "number", min: 1, required: true },
    { name: "reasonCode", label: "Reason", required: true, placeholder: "Rebinning" },
  ];

  return (
    <>
      <PageHeader title={`${card.product.sku} · ${card.product.name}`} description={`Stock card · ledger total ${formatNumber(totals.total)} ${card.product.uom}`} />

      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <div>
          <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Movement history</h2>
          <DataTable
            rows={card.movements}
            rowKey={(row) => row.id}
            empty="No movements recorded for this product."
            columns={[
              { key: "date", label: "When", render: (row) => <span className="whitespace-nowrap text-xs">{formatDate(row.createdAt)}</span> },
              { key: "type", label: "Type", render: (row) => <Badge value={row.type} /> },
              { key: "quantity", label: "Quantity", className: "text-right", render: (row) => (
                <span className={row.quantity < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}>
                  {row.quantity > 0 ? "+" : ""}{formatNumber(row.quantity)}
                </span>
              ) },
              { key: "bin", label: "Bin", render: (row) => <span className="font-mono text-xs">{row.bin}</span> },
              { key: "reference", label: "Reference", render: (row) => <span className="font-mono text-xs text-zinc-500">{row.reference}</span> },
              { key: "actor", label: "Actor", render: (row) => row.actor },
            ]}
          />
        </div>

        <div className="space-y-5">
          <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Adjust stock</h2>
            <AutoForm action={createAdjustmentAction} fields={adjustmentFields} submitLabel="Post adjustment" />
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Transfer between bins</h2>
            <AutoForm action={transferStockAction} fields={transferFields} submitLabel="Transfer" />
          </div>
        </div>
      </div>
    </>
  );
}
