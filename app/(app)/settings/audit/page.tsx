import { DataTable } from "@/components/ui/data-table";
import { Forbidden } from "@/components/ui/forbidden";
import { PageHeader } from "@/components/ui/page-header";
import { hasCapability } from "@/lib/auth/authorize";
import { listAuditLogs } from "@/lib/modules/settings/queries";

// This authenticated screen reads request-time session/stock data.
export const instant = false;

export default async function AuditPage() {
  if (!(await hasCapability("export"))) return <Forbidden capability="export" />;
  const rows = await listAuditLogs();

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Who changed what, when, and why. Stock movements have their own ledger on each stock card."
        actions={
          // eslint-disable-next-line @next/next/no-html-link-for-pages -- Route Handler download, not a page navigation
          <a href="/api/exports/audit" className="h-10 inline-flex items-center rounded-lg bg-amber-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-amber-400">
            Export CSV
          </a>
        }
      />
      <DataTable
        rows={rows}
        rowKey={(row) => row.id}
        empty="No audit entries recorded yet."
        columns={[
          { key: "when", label: "When", render: (row) => <span className="whitespace-nowrap text-xs text-zinc-500">{row.when}</span> },
          { key: "actor", label: "Actor", render: (row) => <span className="font-medium text-zinc-900 dark:text-zinc-50">{row.actor}</span> },
          { key: "action", label: "Action", render: (row) => <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] dark:bg-zinc-800">{row.action}</code> },
          { key: "entity", label: "Entity", render: (row) => row.entity },
          { key: "detail", label: "Detail", render: (row) => <span className="text-zinc-500 dark:text-zinc-400">{row.detail}</span> },
        ]}
      />
    </>
  );
}
