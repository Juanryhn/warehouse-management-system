import { describe, expect, it } from "vitest";
import {
  adjustmentSchema,
  countLineSchema,
  csvImportSchema,
  locationSchema,
  orderSchema,
  productSchema,
} from "@/lib/validation";

const id = "507f1f77bcf86cd799439011";

describe("boundary schemas", () => {
  it("accepts a valid product and rejects negative stock", () => {
    const valid = {
      sku: " sku-1 ",
      barcode: "",
      name: "Scanner",
      categoryId: id,
      uom: "pcs",
      minStock: "0",
      description: "",
    };
    expect(productSchema.parse(valid).sku).toBe("sku-1");
    expect(productSchema.safeParse({ ...valid, minStock: "-1" }).success).toBe(false);
  });

  it("restricts bin codes to letters, numbers and dashes", () => {
    expect(locationSchema.safeParse({ code: "A-01-02", zone: "A", type: "storage" }).success).toBe(true);
    expect(locationSchema.safeParse({ code: "A 01", zone: "A", type: "storage" }).success).toBe(false);
  });

  it("allows signed non-zero adjustments only", () => {
    const base = { productId: id, locationId: id, reasonCode: "Correction" };
    expect(adjustmentSchema.parse({ ...base, quantity: "-2" }).quantity).toBe(-2);
    expect(adjustmentSchema.safeParse({ ...base, quantity: "0" }).success).toBe(false);
  });

  it("requires positive order quantities and valid ids", () => {
    expect(orderSchema.safeParse({ customer: "Branch A", productId: id, ordered: "3" }).success).toBe(true);
    expect(orderSchema.safeParse({ customer: "Branch A", productId: "bad", ordered: "3" }).success).toBe(false);
    expect(orderSchema.safeParse({ customer: "Branch A", productId: id, ordered: "0" }).success).toBe(false);
  });

  it("rejects negative counted quantities", () => {
    const input = { countId: id, lineId: "line-1", counted: "-1" };
    expect(countLineSchema.safeParse(input).success).toBe(false);
    expect(countLineSchema.parse({ ...input, counted: "0" }).counted).toBe(0);
  });

  it("requires CSV content", () => {
    expect(csvImportSchema.safeParse({ csv: "   " }).success).toBe(false);
    expect(csvImportSchema.safeParse({ csv: "sku,name\nX,Y" }).success).toBe(true);
  });
});
