import "server-only";
import type { Db } from "mongodb";
import { getDb } from "./client";
import { ensureIndexes } from "./indexes";
import { ensureSeeded } from "./seed";
import type { DbCollections } from "./types";

const ready = globalThis as unknown as { wmsReadyDb?: Promise<Db> };

export const getReadyDb = (): Promise<Db> =>
  (ready.wmsReadyDb ??= (async () => {
    const db = await getDb();
    await ensureIndexes(db);
    await ensureSeeded(db);
    return db;
  })());

export const getCollections = async (): Promise<DbCollections> => {
  const db = await getReadyDb();
  return {
    users: db.collection("users"),
    sessions: db.collection("sessions"),
    warehouses: db.collection("warehouses"),
    locations: db.collection("locations"),
    categories: db.collection("categories"),
    products: db.collection("products"),
    stockLevels: db.collection("stockLevels"),
    stockMovements: db.collection("stockMovements"),
    adjustments: db.collection("adjustments"),
    receipts: db.collection("receipts"),
    orders: db.collection("orders"),
    counts: db.collection("counts"),
    suppliers: db.collection("suppliers"),
    customers: db.collection("customers"),
    reasons: db.collection("reasons"),
    auditLogs: db.collection("auditLogs"),
  };
};

export const nextNumber = async (
  collection: DbCollections["receipts"] | DbCollections["orders"] | DbCollections["counts"] | DbCollections["adjustments"],
  prefix: string,
): Promise<string> => {
  const last = await collection.findOne({}, { sort: { number: -1 }, projection: { number: 1 } });
  const sequence = last ? Number.parseInt(last.number.split("-").at(-1) ?? "0", 10) + 1 : 1;
  return `${prefix}-${String(sequence).padStart(5, "0")}`;
};
