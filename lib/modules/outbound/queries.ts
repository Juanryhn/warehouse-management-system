import "server-only";
import { ObjectId } from "mongodb";
import { requireUser } from "@/lib/auth/session";
import { getRequestCollections } from "@/lib/db/request";
import { formatDate } from "@/lib/format";

export const listOrders = async () => {
  await requireUser();
  const { orders } = await getRequestCollections();
  const docs = await orders.find({}).sort({ createdAt: -1 }).limit(200).toArray();
  return docs.map((doc) => ({
    id: doc._id.toHexString(),
    number: doc.number,
    customer: doc.customer,
    status: doc.status,
    lines: doc.lines.length,
    ordered: doc.lines.reduce((sum, line) => sum + line.ordered, 0),
    allocated: doc.lines.reduce((sum, line) => sum + line.allocations.reduce((total, allocation) => total + allocation.quantity, 0), 0),
    createdAt: formatDate(doc.createdAt),
  }));
};

export const getOrder = async (id: string) => {
  await requireUser();
  if (!ObjectId.isValid(id)) return null;
  const { orders, products, locations } = await getRequestCollections();
  const [doc, productDocs, locationDocs] = await Promise.all([
    orders.findOne({ _id: new ObjectId(id) }),
    products.find({}).toArray(),
    locations.find({}).toArray(),
  ]);
  if (!doc) return null;

  const productNames = new Map(productDocs.map((item) => [item._id.toHexString(), `${item.sku} · ${item.name}`]));
  const binCodes = new Map(locationDocs.map((item) => [item._id.toHexString(), item.code]));

  return {
    id: doc._id.toHexString(),
    number: doc.number,
    customer: doc.customer,
    status: doc.status,
    createdAt: doc.createdAt,
    lines: doc.lines.map((line) => ({
      id: line.id,
      product: productNames.get(line.productId) ?? "—",
      ordered: line.ordered,
      allocated: line.allocations.reduce((sum, allocation) => sum + allocation.quantity, 0),
      picked: line.allocations.reduce((sum, allocation) => sum + allocation.picked, 0),
      backorder: Math.max(0, line.ordered - line.allocations.reduce((sum, allocation) => sum + allocation.quantity, 0)),
      allocations: line.allocations.map((allocation) => ({
        locationId: allocation.locationId,
        bin: binCodes.get(allocation.locationId) ?? "—",
        quantity: allocation.quantity,
        picked: allocation.picked,
      })),
    })),
  };
};

export const getCustomerOptions = async () => {
  await requireUser();
  const { customers } = await getRequestCollections();
  const docs = await customers.find({ isActive: true }).sort({ name: 1 }).toArray();
  return docs.map((doc) => ({ value: doc.name, label: doc.name }));
};
