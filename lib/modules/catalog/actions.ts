"use server";

import { ObjectId } from "mongodb";
import { parse } from "csv-parse/sync";
import { updateTag } from "next/cache";
import { requireCapability } from "@/lib/auth/authorize";
import { getCollections, getReadyDb } from "@/lib/db/ready";
import type { CategoryDoc } from "@/lib/db/types";
import { EMPTY_FORM_STATE, toFormState, type FormState } from "@/lib/forms";
import { csvImportSchema, productSchema } from "@/lib/validation";

const invalidate = () => {
  updateTag("products");
  updateTag("reference");
  updateTag("stock");
};

export const saveProductAction = async (_previous: FormState, formData: FormData): Promise<FormState> => {
  try {
    const user = await requireCapability("manageCatalog");
    const id = String(formData.get("id") ?? "");
    const input = productSchema.parse(Object.fromEntries(formData.entries()));
    const { products, auditLogs } = await getCollections();

    const values = {
      sku: input.sku.toUpperCase(),
      barcode: input.barcode,
      name: input.name,
      categoryId: input.categoryId,
      uom: input.uom,
      minStock: input.minStock,
      description: input.description,
      isActive: input.isActive === "on",
      updatedAt: new Date(),
    };

    if (id && ObjectId.isValid(id)) {
      await products.updateOne({ _id: new ObjectId(id) }, { $set: values });
      await auditLogs.insertOne({
        _id: new ObjectId(), actorId: user.id, action: "update-product", entityType: "product",
        entityId: id, detail: values.sku, createdAt: new Date(),
      });
    } else {
      const result = await products.insertOne({
        ...values,
        _id: new ObjectId(),
        createdAt: new Date(),
      });
      await auditLogs.insertOne({
        _id: new ObjectId(), actorId: user.id, action: "create-product", entityType: "product",
        entityId: result.insertedId.toHexString(), detail: values.sku, createdAt: new Date(),
      });
    }

    invalidate();
    return { ...EMPTY_FORM_STATE, notice: "Product saved.", redirectTo: "/products" };
  } catch (error) {
    return toFormState(error);
  }
};

type CsvRow = { sku?: string; name?: string; barcode?: string; category?: string; uom?: string; min_stock?: string };

export const importProductsAction = async (_previous: FormState, formData: FormData): Promise<FormState> => {
  try {
    const user = await requireCapability("manageCatalog");
    const input = csvImportSchema.parse(Object.fromEntries(formData.entries()));
    const rows = parse(input.csv, { columns: true, skip_empty_lines: true, trim: true }) as CsvRow[];
    if (rows.length === 0) return { error: "No rows found." };
    if (rows.length > 1000) return { error: "Import is limited to 1,000 rows." };

    const { products, categories, auditLogs } = await getCollections();
    const categoriesByName = new Map((await categories.find({}).toArray()).map((doc) => [doc.name.toLowerCase(), doc]));
    const errors: string[] = [];
    const docs: Parameters<typeof products.insertOne>[0][] = [];

    rows.forEach((row, index) => {
      const line = index + 2;
      const sku = row.sku?.trim().toUpperCase() ?? "";
      const name = row.name?.trim() ?? "";
      const category = categoriesByName.get((row.category ?? "General").toLowerCase()) as CategoryDoc | undefined;
      const minStock = Number(row.min_stock ?? 0);

      if (!sku || !name) errors.push(`Line ${line}: SKU and name are required.`);
      if (!category) errors.push(`Line ${line}: unknown category "${row.category}".`);
      if (!Number.isInteger(minStock) || minStock < 0) errors.push(`Line ${line}: min_stock must be a whole number.`);
      if (errors.some((entry) => entry.startsWith(`Line ${line}:`))) return;

      docs.push({
        _id: new ObjectId(),
        sku,
        barcode: row.barcode?.trim() ?? "",
        name,
        categoryId: category!._id.toHexString(),
        uom: row.uom?.trim() || "pcs",
        minStock,
        description: "",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    if (errors.length > 0) return { error: `${errors.length} row(s) failed validation.`, notice: errors.slice(0, 10).join(" · ") };
    if (input.dryRun === "on") return { notice: `Dry run passed: ${docs.length} row(s) ready to import.` };

    const db = await getReadyDb();
    const session = db.client.startSession();
    try {
      await session.withTransaction(async () => {
        await products.insertMany(docs, { session });
        await auditLogs.insertOne({
          _id: new ObjectId(), actorId: user.id, action: "import-products", entityType: "product",
          entityId: "csv", detail: `${docs.length} rows`, createdAt: new Date(),
        }, { session });
      });
    } finally {
      await session.endSession();
    }

    invalidate();
    return { ...EMPTY_FORM_STATE, notice: `Imported ${docs.length} product(s).` };
  } catch (error) {
    return toFormState(error);
  }
};
