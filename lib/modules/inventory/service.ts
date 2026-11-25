import "server-only";
import { ObjectId, type ClientSession, type Db } from "mongodb";
import { getReadyDb } from "@/lib/db/ready";
import { env } from "@/lib/env";
import type { MovementType } from "@/lib/db/types";

export class StockError extends Error {}

export type StockWrite = {
  type: MovementType;
  productId: string;
  locationId: string;
  quantity: number;
  referenceType: string;
  referenceId: string;
  lineId?: string;
  reasonCode?: string;
  actorId: string;
  fromLocationId?: string;
  toLocationId?: string;
};

export type TransactionContext = {
  db: Db;
  session: ClientSession;
  apply: (writes: StockWrite[]) => Promise<void>;
  adjustReserved: (input: { productId: string; locationId: string; delta: number }) => Promise<void>;
  audit: (entry: { actorId: string; action: string; entityType: string; entityId: string; detail: string }) => Promise<void>;
  assertNoActiveCount: (locationId: string) => Promise<void>;
};

const ensureLevel = async (db: Db, productId: string, locationId: string, session: ClientSession) => {
  const warehouse = await db.collection("warehouses").findOne({ code: "MAIN" }, { session });
  if (!warehouse) throw new StockError("Warehouse is not configured.");

  await db.collection("stockLevels").updateOne(
    { productId, locationId },
    {
      $setOnInsert: {
        _id: new ObjectId(),
        warehouseId: warehouse._id.toHexString(),
        onHand: 0,
        reserved: 0,
        version: 1,
      },
      $set: { updatedAt: new Date() },
    },
    { upsert: true, session },
  );
};

const uniqueKeyFor = (write: StockWrite): string =>
  [
    write.referenceType,
    write.referenceId,
    write.lineId ?? "",
    write.type,
    write.locationId,
  ].join(":");

const applyOne = async (db: Db, write: StockWrite, session: ClientSession): Promise<void> => {
  await ensureLevel(db, write.productId, write.locationId, session);
  const uniqueKey = uniqueKeyFor(write);

  const existing = await db.collection("stockMovements").findOne({ uniqueKey }, { session });
  if (existing) return;

  const filter =
    write.quantity >= 0
      ? { productId: write.productId, locationId: write.locationId }
      : { productId: write.productId, locationId: write.locationId, onHand: { $gte: -write.quantity } };

  const updated = await db.collection("stockLevels").updateOne(
    filter,
    { $inc: { onHand: write.quantity, version: 1 }, $set: { updatedAt: new Date() } },
    { session },
  );
  if (updated.matchedCount !== 1) throw new StockError("Insufficient stock in this bin.");

  await db.collection("stockMovements").insertOne(
    {
      _id: new ObjectId(),
      type: write.type,
      productId: write.productId,
      locationId: write.locationId,
      fromLocationId: write.fromLocationId ?? "",
      toLocationId: write.toLocationId ?? "",
      quantity: write.quantity,
      referenceType: write.referenceType,
      referenceId: write.referenceId,
      lineId: write.lineId ?? "",
      reasonCode: write.reasonCode ?? "",
      actorId: write.actorId,
      uniqueKey,
      createdAt: new Date(),
    },
    { session },
  );
};

// The optional db parameter keeps the single write path testable against an
// isolated replica set without changing production call sites.
export const runStockTransaction = async <T>(
  work: (context: TransactionContext) => Promise<T>,
  options: { db?: Db } = {},
): Promise<T> => {
  const db = options.db ?? (await getReadyDb());
  const session = db.client.startSession();

  const context: TransactionContext = {
    db,
    session,
    apply: async (writes) => {
      for (const write of writes) await applyOne(db, write, session);
    },
    adjustReserved: async ({ productId, locationId, delta }) => {
      const updated = await db.collection("stockLevels").updateOne(
        {
          productId,
          locationId,
          $expr: {
            $and: [
              { $gte: ["$reserved", -delta] },
              { $lte: [{ $add: ["$reserved", delta] }, "$onHand"] },
            ],
          },
        },
        { $inc: { reserved: delta, version: 1 }, $set: { updatedAt: new Date() } },
        { session },
      );
      if (updated.matchedCount !== 1) throw new StockError("Not enough available stock to reserve.");
    },
    audit: async (entry) => {
      await db.collection("auditLogs").insertOne({ _id: new ObjectId(), ...entry, createdAt: new Date() }, { session });
    },
    assertNoActiveCount: async (locationId) => {
      const active = await db.collection("counts").countDocuments(
        { status: { $in: ["draft", "counted"] }, "lines.locationId": locationId },
        { session },
      );
      if (active > 0) throw new StockError("A cycle count is in progress for this bin.");
    },
  };

  try {
    let result!: T;
    await session.withTransaction(async () => {
      result = await work(context);
    }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
    return result;
  } finally {
    await session.endSession();
  }
};

export const needsApproval = (quantity: number): boolean =>
  Math.abs(quantity) > env.ADJUSTMENT_APPROVAL_THRESHOLD;
