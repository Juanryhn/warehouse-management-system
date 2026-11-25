import Link from "next/link";
import { connection } from "next/server";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { can } from "@/lib/auth/authorize";
import { getCurrentUser } from "@/lib/auth/session";
import { getReport, isReportKey, REPORT_KEYS } from "@/lib/modules/reports/queries";

// This authenticated screen reads request-time session/stock data.
export const instant = false;

const LABELS: Record<string, string> = {
  stock: "Stock on hand",
  movements: "Movement history",
  receipts: "Receipts",
  orders: "Orders",
  counts: "Count variance",
  audit: "Audit log",
};

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ report?: string }>;
}) {
  await connection();
  const params = await searchParams;
  const requested = params.report ?? "";
  const key = isReportKey(requested) ? requested : "stock";
  const [report, user] = await Promise.all([getReport(key), getCurrentUser()]);

  const columns = report.headers.map((label, index) => ({
    key: `col-${index}`,
    label,
    render: (row: string[]) => row[index] ?? "—",
  }));

  return (
    <>
      <PageHeader
        title="Reports"
        description="Ledger-backed views. Every figure can be exported with the same columns you see here."
        actions={user && can(user.role, "export") ? (
          <a
            href={`/api/exports/${key}`}
            className="h-10 inline-flex items-center rounded-lg bg-amber-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-amber-400"
          >
            Export CSV
          </a>
        ) : undefined}
      />
      <nav aria-label="Reports" className="mb-5 flex flex-wrap gap-2">
        {REPORT_KEYS.map((item) => (
          <Link
            key={item}
            href={`/reports?report=${item}`}
            aria-current={item === key ? "page" : undefined}
            className={`rounded-lg px-3.5 py-2 text-sm font-medium transition ${
              item === key
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            }`}
          >
            {LABELS[item]}
          </Link>
        ))}
      </nav>
      <div className="mb-4">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{report.title}</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{report.description}</p>
      </div>
      <DataTable rows={report.rows} rowKey={(row) => row.join("|")} empty="No rows for this report yet." columns={columns} />
    </>
  );
}
