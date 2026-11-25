import { notFound } from "next/navigation";
import { AutoForm, type FormField } from "@/components/ui/auto-form";
import { Badge, PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { formatDate, formatNumber } from "@/lib/format";
import { getProductOptions } from "@/lib/modules/catalog/queries";
import { getLocationOptions } from "@/lib/modules/locations/queries";
import { addReceiptLineAction, cancelReceiptAction, receiveLineAction } from "@/lib/modules/inbound/actions";
import { getReceipt } from "@/lib/modules/inbound/queries";

// This authenticated screen reads request-time session/stock data.
export const instant = false;

export default async function ReceiptDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [receipt, products, locations] = await Promise.all([
    getReceipt(id),
    getProductOptions(),
    getLocationOptions(),
  ]);
  if (!receipt) notFound();

  const editable = receipt.status === "draft" || receipt.status === "partial";
  const addLineFields: FormField[] = [
    { name: "receiptId", label: "Receipt", type: "hidden", defaultValue: receipt.id },
    { name: "productId", label: "Product", type: "select", required: true, options: products },
    { name: "expected", label: "Expected quantity", type: "number", min: 1, required: true },
  ];
  const cancelFields: FormField[] = [{ name: "receiptId", label: "Receipt", type: "hidden", defaultValue: receipt.id }];

  const receiveFields = (lineId: string): FormField[] => [
    { name: "receiptId", label: "Receipt", type: "hidden", defaultValue: receipt.id },
    { name: "lineId", label: "Line", type: "hidden", defaultValue: lineId },
    { name: "quantity", label: "Quantity", type: "number", min: 1, required: true },
    { name: "locationId", label: "Bin", type: "select", required: true, options: locations },
  ];

  return (
    <>
      <PageHeader
        title={receipt.number}
        description={`${receipt.supplier} · created ${formatDate(receipt.createdAt)}`}
        actions={<Badge value={receipt.status} />}
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <DataTable
          rows={receipt.lines}
          rowKey={(row) => row.id}
          empty="This receipt has no lines."
          columns={[
            { key: "product", label: "Product", render: (row) => row.product },
            { key: "expected", label: "Expected", className: "text-right", render: (row) => formatNumber(row.expected) },
            { key: "received", label: "Received", className: "text-right", render: (row) => formatNumber(row.received) },
            { key: "bin", label: "Putaway bin", render: (row) => <span className="font-mono text-xs">{row.bin}</span> },
            { key: "receive", label: "Receive", render: (row) =>
              editable && row.received < row.expected ? (
                <AutoForm action={receiveLineAction} fields={receiveFields(row.id)} submitLabel="Receive" />
              ) : null
            },
          ]}
        />
        <div className="space-y-5">
          {editable ? (
            <>
              <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Add line</h2>
                <AutoForm action={addReceiptLineAction} fields={addLineFields} submitLabel="Add line" />
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Cancel receipt</h2>
                <AutoForm action={cancelReceiptAction} fields={cancelFields} submitLabel="Cancel receipt" />
              </div>
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}
