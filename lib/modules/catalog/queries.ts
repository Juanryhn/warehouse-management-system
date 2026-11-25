import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { ObjectId, type Filter } from "mongodb";
import { requireUser } from "@/lib/auth/session";
import { getCollections } from "@/lib/db/ready";
import { getRequestCollections } from "@/lib/db/request";
import type { ProductDoc } from "@/lib/db/types";

export type ProductRow = {
  id: string;
  sku: string;
  name: string;
  category: string;
  uom: string;
  minStock: number;
  onHand: number;
  isActive: boolean;
};

export type ListParams = { q?: string; category?: string; status?: string; page?: number; pageSize?: number };

type CachedProduct = Omit<ProductRow, "onHand">;
type CachedList = { rows: CachedProduct[]; total: number };
type NormalizedParams = { q: string; category: string; status: string; page: number; pageSize: number };

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const listProductsCached = async (params: NormalizedParams): Promise<CachedList> => {
  "use cache";
  cacheLife("minutes");
  cacheTag("products");

  const { products, categories } = await getCollections();
  const filter: Filter<ProductDoc> = {};
  if (params.q) {
    const expression = { $regex: escapeRegex(params.q), $options: "i" };
    filter.$or = [{ sku: expression }, { name: expression }, { barcode: expression }];
  }
  if (params.category && ObjectId.isValid(params.category)) filter.categoryId = params.category;
  if (params.status === "active") filter.isActive = true;
  if (params.status === "archived") filter.isActive = false;

  const [docs, total, categoryDocs] = await Promise.all([
    products.find(filter).sort({ sku: 1 }).skip((params.page - 1) * params.pageSize).limit(params.pageSize).toArray(),
    products.countDocuments(filter),
    categories.find({}).toArray(),
  ]);

  const categoryNames = new Map(categoryDocs.map((item) => [item._id.toHexString(), item.name]));
  return {
    rows: docs.map((doc) => ({
      id: doc._id.toHexString(),
      sku: doc.sku,
      name: doc.name,
      category: categoryNames.get(doc.categoryId) ?? "—",
      uom: doc.uom,
      minStock: doc.minStock,
      isActive: doc.isActive,
    })),
    total,
  };
};

export const listProducts = async (params: ListParams): Promise<{ rows: ProductRow[]; total: number }> => {
  await requireUser();
  const normalized: NormalizedParams = {
    q: params.q ?? "",
    category: params.category ?? "",
    status: params.status ?? "",
    page: Math.max(1, params.page ?? 1),
    pageSize: Math.min(100, Math.max(1, params.pageSize ?? 25)),
  };

  const [base, { stockLevels }] = await Promise.all([
    listProductsCached(normalized),
    getRequestCollections(),
  ]);
  // Stock is intentionally read outside the cache so a pick never sees stale quantities.
  const stock = await stockLevels
    .aggregate<{ _id: string; onHand: number }>([{ $group: { _id: "$productId", onHand: { $sum: "$onHand" } } }])
    .toArray();
  const onHand = new Map(stock.map((item) => [item._id, item.onHand]));

  return {
    rows: base.rows.map((row) => ({ ...row, onHand: onHand.get(row.id) ?? 0 })),
    total: base.total,
  };
};

const listCategoriesCached = async (): Promise<{ id: string; name: string }[]> => {
  "use cache";
  cacheLife("minutes");
  cacheTag("products");
  const { categories } = await getCollections();
  const docs = await categories.find({ isActive: true }).sort({ name: 1 }).toArray();
  return docs.map((doc) => ({ id: doc._id.toHexString(), name: doc.name }));
};

export const listCategories = async (): Promise<{ id: string; name: string }[]> => {
  await requireUser();
  return listCategoriesCached();
};

const getProductOptionsCached = async (): Promise<{ value: string; label: string }[]> => {
  "use cache";
  cacheLife("minutes");
  cacheTag("products");
  const { products } = await getCollections();
  const docs = await products.find({ isActive: true }).sort({ sku: 1 }).toArray();
  return docs.map((doc) => ({ value: doc._id.toHexString(), label: `${doc.sku} · ${doc.name}` }));
};

export const getProductOptions = async (): Promise<{ value: string; label: string }[]> => {
  await requireUser();
  return getProductOptionsCached();
};

const getProductCached = async (id: string) => {
  "use cache";
  cacheLife("minutes");
  cacheTag("products");
  if (!ObjectId.isValid(id)) return null;
  const { products } = await getCollections();
  const doc = await products.findOne({ _id: new ObjectId(id) });
  if (!doc) return null;
  return {
    id: doc._id.toHexString(),
    sku: doc.sku,
    barcode: doc.barcode,
    name: doc.name,
    categoryId: doc.categoryId,
    uom: doc.uom,
    minStock: doc.minStock,
    description: doc.description,
    isActive: doc.isActive,
  };
};

export const getProduct = async (id: string) => {
  await requireUser();
  return getProductCached(id);
};
