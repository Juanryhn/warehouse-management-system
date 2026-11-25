import { AutoForm, type FormField } from "@/components/ui/auto-form";
import { PageHeader, Badge } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { formatDate, formatNumber } from "@/lib/format";
import { approveAdjustmentAction, rejectAdjustmentAction } from "@/lib/modules/inventory/actions";
import { listAdjustments } from "@/lib/modules/inventory/queries";

// This authenticated screen reads request-time session/stock data.
export const instant = false;

export default async function AdjustmentsPage() {
  const rows = await listAdjustments("pending");

  const fieldsFor = (id: string, action: string): FormField[] => [
    { name: "id", label: "ID", type: "hidden", defaultValue: id },
    { name: "action", label: "Action", type: "hidden", defaultValue: action },
  ];

  return (
    <>
      <PageHeader title="Pending adjustments" description="Manager approval posts the stock movement; rejection leaves stock untouched." />
      <DataTable
        rows={rows}
        rowKey={(row) => row.id}
        empty="No adjustments waiting for approval."
        columns={[
          { key: "number", label: "Number", render: (row) => <span className="font-mono text-xs">{row.number}</span> },
          { key: "product", label: "Product", render: (row) => row.product },
          { key: "bin", label: "Bin", render: (row) => <span className="font-mono text-xs">{row.bin}</span> },
          { key: "quantity", label: "Quantity", className: "text-right", render: (row) => formatNumber(row.quantity) },
          { key: "reason", label: "Reason", render: (row) => row.reason },
          { key: "date", label: "Requested", render: (row) => <span className="text-xs">{formatDate(row.createdAt)}</span> },
          { key: "status", label: "Status", render: (row) => <Badge value={row.status} /> },
          { key: "actions", label: "Actions", render: (row) => (
            <div className="flex gap-2">
              <AutoForm action={approveAdjustmentAction} fields={fieldsFor(row.id, "approve")} submitLabel="Approve" />
              <AutoForm action={rejectAdjustmentAction} fields={fieldsFor(row.id, "reject")} submitLabel="Reject" />
            </div>
          ) },
        ]}
      />
    </>
  );
}
