import "server-only";
import { ObjectId, type Db } from "mongodb";
import { hashPassword } from "@/lib/auth/password";
import { env } from "@/lib/env";
import type { ProductDoc } from "./types";

const state = globalThis as unknown as { wmsSeeded?: Promise<void> };

// Deterministic ids make the demo seed safe to re-run after an interrupted setup.
const seedId = (value: number): ObjectId => new ObjectId(value.toString(16).padStart(24, "0"));

const USERS = [
  { email: "admin@wms.local", name: "Admin User", role: "admin", password: "admin123" },
  { email: "manager@wms.local", name: "Manager User", role: "manager", password: "manager123" },
  { email: "operator@wms.local", name: "Operator User", role: "operator", password: "operator123" },
  { email: "viewer@wms.local", name: "Viewer User", role: "viewer", password: "viewer123" },
] as const;

const PRODUCTS = [
  { sku: "SKU-1001", name: "Barcode scanner", minStock: 5 },
  { sku: "SKU-1002", name: "Thermal label roll", minStock: 20 },
  { sku: "SKU-1003", name: "Packing tape", minStock: 12 },
  { sku: "SKU-1004", name: "Corrugated box M", minStock: 30 },
  { sku: "SKU-1005", name: "Safety gloves", minStock: 10 },
  { sku: "SKU-1006", name: "Pallet wrap film", minStock: 8 },
] as const;

const LOCATIONS = [
  { code: "RECV-01", zone: "Receiving", type: "receiving" },
  { code: "A-01-01", zone: "A", type: "storage" },
  { code: "A-01-02", zone: "A", type: "storage" },
  { code: "A-01-03", zone: "A", type: "storage" },
  { code: "PICK-01", zone: "Picking", type: "picking" },
  { code: "Q-01", zone: "Quarantine", type: "quarantine" },
] as const;

const OPENINGS = [
  { sku: "SKU-1001", location: "A-01-01", onHand: 18 },
  { sku: "SKU-1002", location: "A-01-02", onHand: 42 },
  { sku: "SKU-1003", location: "A-01-03", onHand: 8 },
  { sku: "SKU-1004", location: "A-01-01", onHand: 60 },
  { sku: "SKU-1005", location: "PICK-01", onHand: 6 },
  { sku: "SKU-1006", location: "A-01-02", onHand: 4 },
] as const;

const seed = async (db: Db): Promise<void> => {
  const [userCount, productCount] = await Promise.all([
    db.collection("users").countDocuments(),
    db.collection("products").countDocuments(),
  ]);
  if (userCount >= USERS.length && productCount >= PRODUCTS.length) return;

  const passwordHashes = await Promise.all(USERS.map((user) => hashPassword(user.password)));
  const session = db.client.startSession();

  try {
    await session.withTransaction(async () => {
      const now = new Date();
      const users = db.collection("users");
      const warehouses = db.collection("warehouses");
      const locations = db.collection("locations");
      const categories = db.collection("categories");
      const products = db.collection("products");
      const stockLevels = db.collection("stockLevels");
      const movements = db.collection("stockMovements");

      for (const [index, user] of USERS.entries()) {
        await users.updateOne(
          { email: user.email },
          { $setOnInsert: {
            name: user.name,
            role: user.role,
            passwordHash: passwordHashes[index],
            isActive: true,
            createdAt: now,
            updatedAt: now,
          } },
          { upsert: true, session },
        );
      }

      await warehouses.updateOne(
        { code: "MAIN" },
        { $setOnInsert: { _id: seedId(1), name: "Main warehouse", address: "", isActive: true } },
        { upsert: true, session },
      );
      const warehouse = await warehouses.findOne({ code: "MAIN" }, { session });
      if (!warehouse) throw new Error("Warehouse seed failed.");
      const warehouseId = warehouse._id.toHexString();

      await categories.updateOne(
        { name: "General" },
        { $setOnInsert: { _id: seedId(2), isActive: true } },
        { upsert: true, session },
      );
      const category = await categories.findOne({ name: "General" }, { session });
      if (!category) throw new Error("Category seed failed.");
      const categoryId = category._id.toHexString();

      for (const [index, location] of LOCATIONS.entries()) {
        await locations.updateOne(
          { warehouseId, code: location.code },
          { $setOnInsert: {
            _id: seedId(100 + index),
            zone: location.zone,
            type: location.type,
            isActive: true,
          } },
          { upsert: true, session },
        );
      }
      const locationDocs = await locations.find(
        { warehouseId, code: { $in: LOCATIONS.map((location) => location.code) } },
        { session },
      ).toArray();

      for (const [index, product] of PRODUCTS.entries()) {
        await products.updateOne(
          { sku: product.sku },
          { $setOnInsert: {
            _id: seedId(200 + index),
            barcode: "",
            name: product.name,
            categoryId,
            uom: "pcs",
            minStock: product.minStock,
            description: "",
            isActive: true,
            createdAt: now,
            updatedAt: now,
          } },
          { upsert: true, session },
        );
      }
      const productDocs = (await products.find(
        { sku: { $in: PRODUCTS.map((product) => product.sku) } },
        { session },
      ).toArray()) as unknown as ProductDoc[];

      await db.collection("suppliers").updateOne(
        { name: "Northline Supply" },
        { $setOnInsert: { _id: seedId(300), isActive: true } },
        { upsert: true, session },
      );
      await db.collection("suppliers").updateOne(
        { name: "Local Wholesale" },
        { $setOnInsert: { _id: seedId(301), isActive: true } },
        { upsert: true, session },
      );
      await db.collection("customers").updateOne(
        { name: "Retail Branch A" },
        { $setOnInsert: { _id: seedId(400), isActive: true } },
        { upsert: true, session },
      );
      await db.collection("customers").updateOne(
        { name: "Retail Branch B" },
        { $setOnInsert: { _id: seedId(401), isActive: true } },
        { upsert: true, session },
      );
      for (const [index, name] of ["Damage", "Correction", "Cycle count"].entries()) {
        await db.collection("reasons").updateOne(
          { name },
          { $setOnInsert: { _id: seedId(500 + index), isActive: true } },
          { upsert: true, session },
        );
      }

      const locationsByCode = new Map(locationDocs.map((doc) => [doc.code, doc._id.toHexString()]));
      const productsBySku = new Map(productDocs.map((doc) => [doc.sku, doc._id.toHexString()]));

      for (const [index, opening] of OPENINGS.entries()) {
        const productId = productsBySku.get(opening.sku);
        const locationId = locationsByCode.get(opening.location);
        if (!productId || !locationId) continue;

        await stockLevels.updateOne(
          { productId, locationId },
          { $setOnInsert: {
            _id: seedId(600 + index),
            warehouseId,
            onHand: opening.onHand,
            reserved: 0,
            version: 1,
            updatedAt: now,
          } },
          { upsert: true, session },
        );

        const uniqueKey = `seed:opening:${productId}:${locationId}`;
        await movements.updateOne(
          { uniqueKey },
          { $setOnInsert: {
            _id: seedId(700 + index),
            type: "receipt" as const,
            productId,
            locationId,
            fromLocationId: "",
            toLocationId: "",
            quantity: opening.onHand,
            referenceType: "seed",
            referenceId: "opening",
            lineId: uniqueKey,
            reasonCode: "",
            actorId: "seed",
            createdAt: now,
          } },
          { upsert: true, session },
        );
      }
    }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
  } finally {
    await session.endSession();
  }
};

export const ensureSeeded = async (db: Db): Promise<void> => {
  if (env.WMS_SEED === "false") return;
  state.wmsSeeded ??= seed(db).catch((error: unknown) => {
    state.wmsSeeded = undefined;
    throw error;
  });
  await state.wmsSeeded;
};
