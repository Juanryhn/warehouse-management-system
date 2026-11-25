import "server-only";
import { requireUser } from "@/lib/auth/session";
import { getCollections } from "@/lib/db/ready";
import { formatDate, formatNumber } from "@/lib/format";
import { listStock } from "@/lib/modules/inventory/queries";
import { listCounts } from "@/lib/modules/counts/queries";
import { listReceipts } from "@/lib/modules/inbound/queries";
import { listOrders } from "@/lib/modules/outbound/queries";
import { listAuditLogs } from "@/lib/modules/settings/queries";

export const REPORT_KEYS = ["stock", "movements", "receipts", "orders", "counts", "audit"] as const;
export type ReportKey = (typeof REPORT_KEYS)[number];

export type ReportData = {
  key: ReportKey;
  title: string;
  description: string;
  headers: string[];
  rows: string[][];
};

export const isReportKey = (value: string): value is ReportKey => REPORT_KEYS.includes(value as ReportKey);

export const getReport = async (key: ReportKey): Promise<ReportData> => {
  await requireUser();

  if (key === "stock") {
    const rows = await listStock({});
    return {
      key,
      title: "Stock on hand",
      description: "Quantity by product and bin. Excludes reserved stock from the available column.",
      headers: ["SKU", "Product", "Bin", "On hand", "Reserved", "Available"],
      rows: rows.map((row) => [
        row.sku, row.product, row.bin,
        formatNumber(row.onHand), formatNumber(row.reserved), formatNumber(row.available),
      ]),
    };
  }

  if (key === "movements") {
    const { stockMovements, products, locations, users } = await getCollections();
    const [docs, productDocs, locationDocs, userDocs] = await Promise.all([
      stockMovements.find({}).sort({ createdAt: -1 }).limit(500).toArray(),
      products.find({}).toArray(),
      locations.find({}).toArray(),
      users.find({}).toArray(),
    ]);
    const skus = new Map(productDocs.map((doc) => [doc._id.toHexString(), doc.sku]));
    const bins = new Map(locationDocs.map((doc) => [doc._id.toHexString(), doc.code]));
    const names = new Map(userDocs.map((doc) => [doc._id.toHexString(), doc.name]));
    return {
      key,
      title: "Movement history",
      description: "Append-only stock ledger, newest first (latest 500 entries).",
      headers: ["When", "Type", "SKU", "Bin", "Quantity", "Reference", "Reason", "Actor"],
      rows: docs.map((doc) => [
        formatDate(doc.createdAt),
        doc.type,
        skus.get(doc.productId) ?? "—",
        bins.get(doc.locationId) ?? "—",
        formatNumber(doc.quantity),
        doc.referenceId,
        doc.reasonCode,
        doc.actorId === "seed" ? "System" : (names.get(doc.actorId) ?? "Unknown"),
      ]),
    };
  }

  if (key === "receipts") {
    const rows = await listReceipts();
    return {
      key,
      title: "Receipt history",
      description: "Inbound documents with expected and received quantities.",
      headers: ["Number", "Supplier", "Lines", "Expected", "Received", "Status", "Created"],
      rows: rows.map((row) => [
        row.number, row.supplier, formatNumber(row.lines), formatNumber(row.expected),
        formatNumber(row.received), row.status, row.createdAt,
      ]),
    };
  }

  if (key === "orders") {
    const rows = await listOrders();
    return {
      key,
      title: "Order history",
      description: "Outbound documents with allocated quantities.",
      headers: ["Number", "Customer", "Lines", "Ordered", "Allocated", "Status", "Created"],
      rows: rows.map((row) => [
        row.number, row.customer, formatNumber(row.lines), formatNumber(row.ordered),
        formatNumber(row.allocated), row.status, row.createdAt,
      ]),
    };
  }

  if (key === "counts") {
    const rows = await listCounts();
    return {
      key,
      title: "Count variance",
      description: "Cycle counts and their net variance after counting.",
      headers: ["Number", "Scope", "Lines", "Variance", "Status", "Created"],
      rows: rows.map((row) => [
        row.number, row.scope, formatNumber(row.lines), formatNumber(row.variance), row.status, row.createdAt,
      ]),
    };
  }

  const rows = await listAuditLogs();
  return {
    key,
    title: "Audit log",
    description: "User management, approvals, cancellations and configuration changes.",
    headers: ["When", "Actor", "Action", "Entity", "Detail"],
    rows: rows.map((row) => [row.when, row.actor, row.action, row.entity, row.detail]),
  };
};
