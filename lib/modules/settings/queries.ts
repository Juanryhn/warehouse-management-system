import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { requireCapability } from "@/lib/auth/authorize";
import { requireUser } from "@/lib/auth/session";
import { getCollections } from "@/lib/db/ready";
import { getRequestCollections } from "@/lib/db/request";
import { formatDate } from "@/lib/format";
import { env } from "@/lib/env";

export const listUsers = async () => {
  await requireCapability("manageUsers");
  const { users } = await getRequestCollections();
  const docs = await users.find({}).sort({ email: 1 }).toArray();
  return docs.map((doc) => ({
    id: doc._id.toHexString(),
    email: doc.email,
    name: doc.name,
    role: doc.role,
    isActive: doc.isActive,
    createdAt: formatDate(doc.createdAt),
  }));
};

export const listAuditLogs = async () => {
  await requireUser();
  const { auditLogs, users } = await getRequestCollections();
  const [docs, userDocs] = await Promise.all([
    auditLogs.find({}).sort({ createdAt: -1 }).limit(200).toArray(),
    users.find({}).toArray(),
  ]);
  const names = new Map(userDocs.map((doc) => [doc._id.toHexString(), doc.name]));
  return docs.map((doc) => ({
    id: doc._id.toHexString(),
    when: formatDate(doc.createdAt),
    actor: doc.actorId === "seed" ? "System" : (names.get(doc.actorId) ?? doc.actorId),
    action: doc.action,
    entity: `${doc.entityType}: ${doc.entityId}`,
    detail: doc.detail,
  }));
};

export type ReferenceKind = "suppliers" | "customers" | "reasons" | "categories";

const listReferenceDataCached = async () => {
  "use cache";
  cacheLife("minutes");
  cacheTag("reference", "products");
  const { suppliers, customers, reasons, categories, products } = await getCollections();
  const [supplierDocs, customerDocs, reasonDocs, categoryDocs, uoms] = await Promise.all([
    suppliers.find({}).sort({ name: 1 }).toArray(),
    customers.find({}).sort({ name: 1 }).toArray(),
    reasons.find({}).sort({ name: 1 }).toArray(),
    categories.find({}).sort({ name: 1 }).toArray(),
    products.distinct("uom"),
  ]);

  const toItems = (docs: { _id: import("mongodb").ObjectId; name: string; isActive: boolean }[]) =>
    docs.map((doc) => ({ id: doc._id.toHexString(), name: doc.name, isActive: doc.isActive }));

  return {
    suppliers: toItems(supplierDocs),
    customers: toItems(customerDocs),
    reasons: toItems(reasonDocs),
    categories: toItems(categoryDocs),
    units: uoms.filter(Boolean).sort().map((uom) => ({ id: uom, name: uom, isActive: true })),
  };
};

export const listReferenceData = async () => {
  await requireCapability("manageCatalog");
  return listReferenceDataCached();
};

export const getSettings = async () => {
  await requireUser();
  return {
    database: env.MONGODB_URI ? "MongoDB (external)" : "MongoDB (local replica set)",
    databaseName: env.MONGODB_DB,
    sessionDays: env.SESSION_DAYS,
    approvalThreshold: env.ADJUSTMENT_APPROVAL_THRESHOLD,
    seeding: env.WMS_SEED === "true" ? "enabled" : "disabled",
    timezone: "Asia/Jakarta",
  };
};
