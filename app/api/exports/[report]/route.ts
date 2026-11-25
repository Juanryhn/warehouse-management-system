import { requireCapability } from "@/lib/auth/authorize";
import { AuthError } from "@/lib/auth/session";
import { getReport, isReportKey } from "@/lib/modules/reports/queries";

const cell = (value: string): string => `"${value.replace(/"/g, '""')}"`;

export async function GET(_request: Request, { params }: { params: Promise<{ report: string }> }) {
  try {
    await requireCapability("export");
    const { report: value } = await params;
    if (!isReportKey(value)) return new Response("Unknown report", { status: 404 });

    const report = await getReport(value);
    const lines = [report.headers, ...report.rows].map((row) => row.map(cell).join(","));
    const body = `\uFEFF${lines.join("\r\n")}\r\n`;

    return new Response(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${report.key}-${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return new Response(error.message, { status: error.status });
    return new Response("Export failed", { status: 500 });
  }
}
