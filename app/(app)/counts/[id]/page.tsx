import { notFound } from "next/navigation";
import { AutoForm, type FormField } from "@/components/ui/auto-form";
import { Badge, PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { formatDate, formatNumber } from "@/lib/format";
import { approveCountAction, enterCountAction, rejectCountAction } from "@/lib/modules/counts/actions";
import { getCount } from "@/lib/modules/counts/queries";

// This authenticated screen reads request-time session/stock data.
export const instant = false;

export default async function CountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const count = await getCount(id);
  if (!count) notFound();

  const editable = count.status === "draft" || count.status === "counted";
  const decisionFields: FormField[] = [{ name: "id", label: "Count", type: "hidden", defaultValue: count.id }];
  const countFields = (lineId: string, expected: number): FormField[] => [
    { name: "countId", label: "Count", type: "hidden", defaultValue: count.id },
    { name: "lineId", label: "Line", type: "hidden", defaultValue: lineId },
    { name: "counted", label: "Counted", type: "number", min: 0, defaultValue: String(expected), required: true },
  ];

  return (
    <>
      <PageHeader
        title={count.number}
        description={`${count.scopeType === "bin" ? "Bin" : "Zone"} ${count.scopeValue} · created ${formatDate(count.createdAt)}`}
        actions={<Badge value={count.status} />}
      />
      <DataTable
        rows={count.lines}
        rowKey={(row) => row.id}
        empty="This count has no lines."
        columns={[
          { key: "product", label: "Product", render: (row) => row.product },
          { key: "bin", label: "Bin", render: (row) => <span className="font-mono text-xs">{row.bin}</span> },
          { key: "expected", label: "Expected", className: "text-right", render: (row) => formatNumber(row.expected) },
          { key: "counted", label: "Counted", className: "text-right", render: (row) => (row.counted === null ? "—" : formatNumber(row.counted)) },
          { key: "variance", label: "Variance", className: "text-right", render: (row) => {
            if (row.variance === null) return "—";
            const tone = row.variance === 0 ? "" : "font-semibold text-amber-600 dark:text-amber-400";
            return <span className={tone}>{row.variance > 0 ? "+" : ""}{formatNumber(row.variance)}</span>;
          } },
          { key: "enter", label: "Enter count", render: (row) => editable ? (
            <AutoForm action={enterCountAction} fields={countFields(row.id, row.expected)} submitLabel="Save" />
          ) : null },
        ]}
      />
      {count.status === "counted" ? (
        <div className="mt-5 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Approve variance</h2>
          <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
            Approval posts exactly one adjustment movement per non-zero variance. Rejection leaves stock untouched.
          </p>
          <div className="flex flex-wrap gap-3">
            <AutoForm action={approveCountAction} fields={decisionFields} submitLabel="Approve & post" />
            <AutoForm action={rejectCountAction} fields={decisionFields} submitLabel="Reject" />
          </div>
        </div>
      ) : null}
      {["approved", "rejected"].includes(count.status) ? (
        <p className="mt-5 text-sm text-zinc-500 dark:text-zinc-400">This count is closed and can no longer be changed.</p>
      ) : null}
    </>
  );
}
