import "server-only";
import { ObjectId } from "mongodb";
import { requireUser } from "@/lib/auth/session";
import { getRequestCollections } from "@/lib/db/request";
import { formatDate } from "@/lib/format";

export const listCounts = async () => {
  await requireUser();
  const { counts } = await getRequestCollections();
  const docs = await counts.find({}).sort({ createdAt: -1 }).limit(200).toArray();
  return docs.map((doc) => ({
    id: doc._id.toHexString(),
    number: doc.number,
    scope: doc.scopeType === "bin" ? doc.scopeValue : `Zone ${doc.scopeValue}`,
    status: doc.status,
    lines: doc.lines.length,
    variance: doc.lines.reduce((sum, line) => sum + (line.counted === null ? 0 : line.counted - line.expected), 0),
    createdAt: formatDate(doc.createdAt),
  }));
};

export const getCount = async (id: string) => {
  await requireUser();
  if (!ObjectId.isValid(id)) return null;
  const { counts, products, locations } = await getRequestCollections();
  const [doc, productDocs, locationDocs] = await Promise.all([
    counts.findOne({ _id: new ObjectId(id) }),
    products.find({}).toArray(),
    locations.find({}).toArray(),
  ]);
  if (!doc) return null;

  const productNames = new Map(productDocs.map((item) => [item._id.toHexString(), `${item.sku} · ${item.name}`]));
  const binCodes = new Map(locationDocs.map((item) => [item._id.toHexString(), item.code]));

  return {
    id: doc._id.toHexString(),
    number: doc.number,
    scopeType: doc.scopeType,
    scopeValue: doc.scopeValue,
    status: doc.status,
    createdAt: doc.createdAt,
    lines: doc.lines.map((line) => ({
      id: line.id,
      product: productNames.get(line.productId) ?? "—",
      productId: line.productId,
      bin: binCodes.get(line.locationId) ?? "—",
      expected: line.expected,
      counted: line.counted,
      variance: line.counted === null ? null : line.counted - line.expected,
    })),
  };
};
