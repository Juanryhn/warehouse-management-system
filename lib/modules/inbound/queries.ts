import "server-only";
import { ObjectId } from "mongodb";
import { requireUser } from "@/lib/auth/session";
import { getRequestCollections } from "@/lib/db/request";
import type { ReceiptDoc } from "@/lib/db/types";
import { formatDate } from "@/lib/format";

export const listReceipts = async () => {
  await requireUser();
  const { receipts } = await getRequestCollections();
  const docs = await receipts.find({}).sort({ createdAt: -1 }).limit(200).toArray();
  return docs.map((doc) => ({
    id: doc._id.toHexString(),
    number: doc.number,
    supplier: doc.supplier,
    status: doc.status,
    lines: doc.lines.length,
    expected: doc.lines.reduce((sum, line) => sum + line.expected, 0),
    received: doc.lines.reduce((sum, line) => sum + line.received, 0),
    createdAt: formatDate(doc.createdAt),
  }));
};

export const getReceipt = async (id: string) => {
  await requireUser();
  if (!ObjectId.isValid(id)) return null;
  const { receipts, products, locations } = await getRequestCollections();
  const [doc, productDocs, locationDocs] = await Promise.all([
    receipts.findOne({ _id: new ObjectId(id) }),
    products.find({}).toArray(),
    locations.find({}).toArray(),
  ]);
  if (!doc) return null;

  const productNames = new Map(productDocs.map((item) => [item._id.toHexString(), `${item.sku} · ${item.name}`]));
  const binCodes = new Map(locationDocs.map((item) => [item._id.toHexString(), item.code]));

  return {
    id: doc._id.toHexString(),
    number: doc.number,
    supplier: doc.supplier,
    status: doc.status,
    createdAt: doc.createdAt,
    lines: doc.lines.map((line) => ({
      id: line.id,
      product: productNames.get(line.productId) ?? "—",
      expected: line.expected,
      received: line.received,
      bin: line.locationId ? (binCodes.get(line.locationId) ?? "—") : "—",
    })),
  };
};

export const getSupplierOptions = async () => {
  await requireUser();
  const { suppliers } = await getRequestCollections();
  const docs = await suppliers.find({ isActive: true }).sort({ name: 1 }).toArray();
  return docs.map((doc) => ({ value: doc.name, label: doc.name }));
};

export const getReceiptStatuses = (doc: ReceiptDoc): string => doc.status;
