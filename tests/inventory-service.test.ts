import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { ensureIndexes } from "@/lib/db/indexes";
import { env } from "@/lib/env";
import {
  needsApproval,
  runStockTransaction,
  StockError,
  type StockWrite,
} from "@/lib/modules/inventory/service";

const COLLECTIONS = [
  "users", "sessions", "warehouses", "locations", "categories", "products",
  "stockLevels", "stockMovements", "adjustments", "receipts", "orders", "counts",
  "suppliers", "customers", "reasons", "auditLogs",
];

let replicaSet: MongoMemoryReplSet;
let client: MongoClient;
let db: Db;
let productId: string;
let locationId: string;

const setLevel = async (onHand: number, reserved = 0): Promise<void> => {
  await db.collection("stockLevels").insertOne({
    _id: new ObjectId(),
    productId,
    locationId,
    warehouseId: "test",
    onHand,
    reserved,
    version: 1,
    updatedAt: new Date(),
  });
};

const makeWrite = (quantity: number, suffix: string, overrides: Partial<StockWrite> = {}): StockWrite => ({
  type: quantity >= 0 ? "receipt" : "ship",
  productId,
  locationId,
  quantity,
  referenceType: "test",
  referenceId: `TEST-${suffix}`,
  lineId: suffix,
  reasonCode: "",
  actorId: "tester",
  ...overrides,
});

const level = async () => db.collection("stockLevels").findOne({ productId, locationId });

beforeAll(async () => {
  replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  client = new MongoClient(replicaSet.getUri());
  await client.connect();
  db = client.db("wms_test");
}, 120_000);

afterAll(async () => {
  await client?.close();
  await replicaSet?.stop();
});

beforeEach(async () => {
  await Promise.all(COLLECTIONS.map((name) => db.collection(name).deleteMany({})));
  await db.collection("warehouses").insertOne({
    _id: new ObjectId(), code: "MAIN", name: "Test warehouse", address: "", isActive: true,
  });
  productId = new ObjectId().toHexString();
  locationId = new ObjectId().toHexString();
});

describe("transactional stock service", () => {
  it("creates the partial barcode index on a fresh database", async () => {
    await db.collection("products").drop();

    await ensureIndexes(db);

    const indexes = await db.collection("products").indexes();
    const barcodeIndex = indexes.find((index) => index.name === "barcode_unique");
    expect(barcodeIndex?.partialFilterExpression).toEqual({ barcode: { $gt: "" } });

    await db.collection("products").insertMany([
      { _id: new ObjectId(), sku: "NO-BARCODE-1", barcode: "", name: "A" },
      { _id: new ObjectId(), sku: "NO-BARCODE-2", barcode: "", name: "B" },
      { _id: new ObjectId(), sku: "BARCODED", barcode: "BC-1", name: "C" },
    ]);
    await expect(
      db.collection("products").insertOne({ _id: new ObjectId(), sku: "DUPLICATE", barcode: "BC-1", name: "D" }),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it("applies guarded writes and appends a movement for each one", async () => {
    await setLevel(10);

    await runStockTransaction((context) => context.apply([makeWrite(5, "receive")]), { db });
    await runStockTransaction((context) => context.apply([makeWrite(-3, "ship")]), { db });

    const current = await level();
    expect(current?.onHand).toBe(12);
    expect(current?.version).toBe(3);
    expect(await db.collection("stockMovements").countDocuments()).toBe(2);
  });

  it("refuses to oversell and leaves the ledger unchanged", async () => {
    await setLevel(2);

    await expect(
      runStockTransaction((context) => context.apply([makeWrite(-3, "oversell")]), { db }),
    ).rejects.toBeInstanceOf(StockError);

    expect((await level())?.onHand).toBe(2);
    expect(await db.collection("stockMovements").countDocuments()).toBe(0);
  });

  it("does not apply a write with a repeated idempotency key", async () => {
    await setLevel(5);
    const write = makeWrite(4, "idempotent");

    await runStockTransaction((context) => context.apply([write]), { db });
    await runStockTransaction((context) => context.apply([write]), { db });

    expect((await level())?.onHand).toBe(9);
    expect(await db.collection("stockMovements").countDocuments()).toBe(1);
  });

  it("keeps reservations within available stock", async () => {
    await setLevel(5);

    await runStockTransaction(
      (context) => context.adjustReserved({ productId, locationId, delta: 5 }),
      { db },
    );
    await expect(
      runStockTransaction(
        (context) => context.adjustReserved({ productId, locationId, delta: 1 }),
        { db },
      ),
    ).rejects.toBeInstanceOf(StockError);

    const current = await level();
    expect(current?.reserved).toBe(5);
    expect(current?.onHand).toBe(5);
  });

  it("blocks stock changes while a cycle count is active", async () => {
    await db.collection("counts").insertOne({
      _id: new ObjectId(),
      number: "CNT-00001",
      status: "counted",
      lines: [{ id: "line-1", productId, locationId, expected: 5, counted: 5 }],
    });

    await expect(
      runStockTransaction((context) => context.assertNoActiveCount(locationId), { db }),
    ).rejects.toBeInstanceOf(StockError);
  });

  it("rolls back stock and audit writes when the transaction fails", async () => {
    await setLevel(10);

    await expect(
      runStockTransaction(async (context) => {
        await context.apply([makeWrite(5, "rollback")]);
        await context.audit({
          actorId: "tester", action: "test", entityType: "stock", entityId: "rollback", detail: "test",
        });
        throw new Error("boom");
      }, { db }),
    ).rejects.toThrow("boom");

    expect((await level())?.onHand).toBe(10);
    expect(await db.collection("stockMovements").countDocuments()).toBe(0);
    expect(await db.collection("auditLogs").countDocuments()).toBe(0);
  });

  it("treats approval symmetrically for positive and negative adjustments", () => {
    const threshold = env.ADJUSTMENT_APPROVAL_THRESHOLD;
    expect(needsApproval(threshold)).toBe(false);
    expect(needsApproval(threshold + 1)).toBe(true);
    expect(needsApproval(-threshold - 1)).toBe(true);
  });
});
