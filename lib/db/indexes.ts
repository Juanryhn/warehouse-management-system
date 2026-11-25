import "server-only";
import type { Db } from "mongodb";

// Empty barcodes are not unique values. Index only real, non-empty barcodes so
// multiple products may omit one, while duplicate scanned codes are still rejected.
const ensureBarcodeIndex = async (db: Db): Promise<void> => {
  const products = db.collection("products");
  // createIndex creates a missing collection, but indexes() throws until then.
  const existing = await products.indexes().catch((error: unknown) => {
    if ((error as { code?: number }).code === 26) return [];
    throw error;
  });
  if (existing.some((index) => index.name === "barcode_1" && !index.partialFilterExpression)) {
    await products.dropIndex("barcode_1");
  }
  await products.createIndex(
    { barcode: 1 },
    { name: "barcode_unique", unique: true, partialFilterExpression: { barcode: { $gt: "" } } },
  );
};

export const ensureIndexes = async (db: Db): Promise<void> => {
  await Promise.all([
    db.collection("users").createIndex({ email: 1 }, { unique: true }),
    db.collection("sessions").createIndex({ tokenHash: 1 }, { unique: true }),
    db.collection("sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection("sessions").createIndex({ userId: 1 }),
    db.collection("warehouses").createIndex({ code: 1 }, { unique: true }),
    db.collection("locations").createIndex({ warehouseId: 1, code: 1 }, { unique: true }),
    db.collection("locations").createIndex({ warehouseId: 1, zone: 1 }),
    db.collection("categories").createIndex({ name: 1 }, { unique: true }),
    db.collection("products").createIndex({ sku: 1 }, { unique: true }),
    ensureBarcodeIndex(db),
    db.collection("products").createIndex({ categoryId: 1, name: 1 }),
    db.collection("stockLevels").createIndex({ productId: 1, locationId: 1 }, { unique: true }),
    db.collection("stockLevels").createIndex({ warehouseId: 1, locationId: 1 }),
    db.collection("stockMovements").createIndex({ productId: 1, createdAt: -1 }),
    db.collection("stockMovements").createIndex({ referenceType: 1, referenceId: 1, lineId: 1 }),
    db.collection("stockMovements").createIndex({ uniqueKey: 1 }, { unique: true, sparse: true }),
    db.collection("stockMovements").createIndex({ createdAt: -1 }),
    db.collection("adjustments").createIndex({ number: 1 }, { unique: true }),
    db.collection("adjustments").createIndex({ status: 1, createdAt: -1 }),
    db.collection("receipts").createIndex({ number: 1 }, { unique: true }),
    db.collection("receipts").createIndex({ status: 1, createdAt: -1 }),
    db.collection("orders").createIndex({ number: 1 }, { unique: true }),
    db.collection("orders").createIndex({ status: 1, createdAt: -1 }),
    db.collection("counts").createIndex({ number: 1 }, { unique: true }),
    db.collection("counts").createIndex({ status: 1, createdAt: -1 }),
    db.collection("suppliers").createIndex({ name: 1 }, { unique: true }),
    db.collection("customers").createIndex({ name: 1 }, { unique: true }),
    db.collection("reasons").createIndex({ name: 1 }, { unique: true }),
    db.collection("auditLogs").createIndex({ createdAt: -1 }),
    db.collection("auditLogs").createIndex({ entityType: 1, entityId: 1 }),
  ]);
};
