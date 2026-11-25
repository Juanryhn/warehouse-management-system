import "server-only";
import { ObjectId } from "mongodb";
import { requireUser } from "@/lib/auth/session";
import { getRequestCollections } from "@/lib/db/request";
import type { Filter } from "mongodb";
import type { AdjustmentDoc, MovementDoc } from "@/lib/db/types";

export type StockRow = {
  id: string;
  sku: string;
  product: string;
  bin: string;
  locationId: string;
  productId: string;
  onHand: number;
  reserved: number;
  available: number;
  minStock: number;
};

export const listStock = async ({ q, view }: { q?: string; view?: string }): Promise<StockRow[]> => {
  await requireUser();
  const { stockLevels, products, locations } = await getRequestCollections();
  const [levels, productDocs, locationDocs] = await Promise.all([
    stockLevels.find({}).limit(2000).toArray(),
    products.find({}).toArray(),
    locations.find({}).toArray(),
  ]);

  const productMap = new Map(productDocs.map((doc) => [doc._id.toHexString(), doc]));
  const locationMap = new Map(locationDocs.map((doc) => [doc._id.toHexString(), doc]));
  const needle = q?.toLowerCase();

  return levels
    .map((level) => {
      const product = productMap.get(level.productId);
      const location = locationMap.get(level.locationId);
      return {
        id: level._id.toHexString(),
        productId: level.productId,
        locationId: level.locationId,
        sku: product?.sku ?? "—",
        product: product?.name ?? "Unknown product",
        bin: location?.code ?? "—",
        onHand: level.onHand,
        reserved: level.reserved,
        available: level.onHand - level.reserved,
        minStock: product?.minStock ?? 0,
      };
    })
    .filter((row) => (needle ? `${row.sku} ${row.product} ${row.bin}`.toLowerCase().includes(needle) : true))
    .filter((row) => (view === "low" ? row.onHand < row.minStock : true))
    .sort((left, right) => left.sku.localeCompare(right.sku) || left.bin.localeCompare(right.bin));
};

export const getStockCard = async (productId: string) => {
  await requireUser();
  if (!ObjectId.isValid(productId)) return null;
  const { products, stockMovements, locations, users } = await getRequestCollections();
  const [product, movements, locationDocs, userDocs] = await Promise.all([
    products.findOne({ _id: new ObjectId(productId) }),
    stockMovements.find({ productId }).sort({ createdAt: -1 }).limit(200).toArray(),
    locations.find({}).toArray(),
    users.find({}).toArray(),
  ]);
  if (!product) return null;

  const bins = new Map(locationDocs.map((doc) => [doc._id.toHexString(), doc.code]));
  const actors = new Map(userDocs.map((doc) => [doc._id.toHexString(), doc.name]));

  return {
    product: { id: product._id.toHexString(), sku: product.sku, name: product.name, uom: product.uom },
    movements: movements.map((doc) => ({
      id: doc._id.toHexString(),
      type: doc.type,
      quantity: doc.quantity,
      bin: doc.locationId ? (bins.get(doc.locationId) ?? "—") : "—",
      reference: doc.referenceId,
      reason: doc.reasonCode,
      actor: doc.actorId === "seed" ? "System" : (actors.get(doc.actorId) ?? "Unknown"),
      createdAt: doc.createdAt,
    })),
  };
};

export const listAdjustments = async (status?: string) => {
  await requireUser();
  const { adjustments, products, locations } = await getRequestCollections();
  const filter: Filter<AdjustmentDoc> = status === "pending" ? { status: "pending" } : {};
  const [docs, productDocs, locationDocs] = await Promise.all([
    adjustments.find(filter).sort({ createdAt: -1 }).limit(200).toArray(),
    products.find({}).toArray(),
    locations.find({}).toArray(),
  ]);
  const productNames = new Map(productDocs.map((doc) => [doc._id.toHexString(), `${doc.sku} · ${doc.name}`]));
  const binCodes = new Map(locationDocs.map((doc) => [doc._id.toHexString(), doc.code]));
  return docs.map((doc) => ({
    id: doc._id.toHexString(),
    number: doc.number,
    product: productNames.get(doc.productId) ?? "—",
    bin: binCodes.get(doc.locationId) ?? "—",
    quantity: doc.quantity,
    reason: doc.reasonCode,
    status: doc.status,
    createdAt: doc.createdAt,
  }));
};

export const getMovementCountForProduct = async (productId: string): Promise<{ total: number }> => {
  await requireUser();
  const { stockMovements } = await getRequestCollections();
  const [receipts, issues] = await Promise.all([
    stockMovements.aggregate<{ total: number }>([
      { $match: { productId, quantity: { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: "$quantity" } } },
    ]).toArray(),
    stockMovements.aggregate<{ total: number }>([
      { $match: { productId, quantity: { $lt: 0 } } },
      { $group: { _id: null, total: { $sum: "$quantity" } } },
    ]).toArray(),
  ]);
  return { total: (receipts[0]?.total ?? 0) + (issues[0]?.total ?? 0) };
};

export type { AdjustmentDoc, MovementDoc };
