import { z } from "zod";

const positiveId = z.string().regex(/^[a-f0-9]{24}$/, "Invalid identifier");
const quantity = z.coerce.number().int("Use a whole number").min(0, "Cannot be negative");
const signedQuantity = z.coerce.number().int("Use a whole number").refine((value) => value !== 0, "Cannot be zero");

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
  next: z.string().optional(),
});

export const productSchema = z.object({
  sku: z.string().trim().min(1, "SKU is required").max(40),
  barcode: z.string().trim().max(80),
  name: z.string().trim().min(1, "Name is required").max(160),
  categoryId: z.string(),
  uom: z.string().trim().min(1).max(20),
  minStock: quantity,
  description: z.string().trim().max(500),
  isActive: z.enum(["on", "off"]).optional(),
});

export const locationSchema = z.object({
  code: z.string().trim().min(1, "Bin code is required").max(40).regex(/^[A-Za-z0-9-]+$/, "Use letters, numbers and dashes"),
  zone: z.string().trim().min(1, "Zone is required").max(40),
  type: z.enum(["receiving", "storage", "picking", "quarantine"]),
  isActive: z.enum(["on", "off"]).optional(),
});

export const userSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().email("Enter a valid email").max(200),
  role: z.enum(["admin", "manager", "operator", "viewer"]),
  password: z.string().min(8, "Use at least 8 characters").max(200),
  isActive: z.enum(["on", "off"]).optional(),
});

export const referenceSchema = z.object({ name: z.string().trim().min(1, "Name is required").max(120) });

export const receiptSchema = z.object({
  supplier: z.string().trim().min(1, "Supplier is required"),
  productId: positiveId,
  expected: z.coerce.number().int().positive("Must be greater than zero"),
});

export const receiveSchema = z.object({
  receiptId: positiveId,
  lineId: z.string().min(1),
  quantity: z.coerce.number().int().positive("Must be greater than zero"),
  locationId: positiveId,
});

export const orderSchema = z.object({
  customer: z.string().trim().min(1, "Customer is required"),
  productId: positiveId,
  ordered: z.coerce.number().int().positive("Must be greater than zero"),
});

export const orderLineSchema = z.object({ orderId: positiveId, lineId: z.string().min(1) });

export const countSchema = z.object({
  scopeType: z.enum(["bin", "zone"]),
  scopeValue: z.string().trim().min(1, "Select a scope"),
});

export const countLineSchema = z.object({
  countId: positiveId,
  lineId: z.string().min(1),
  counted: quantity,
});

export const adjustmentSchema = z.object({
  productId: positiveId,
  locationId: positiveId,
  quantity: signedQuantity,
  reasonCode: z.string().trim().min(1, "Reason is required"),
});

export const transferSchema = z.object({
  productId: positiveId,
  fromLocationId: positiveId,
  toLocationId: positiveId,
  quantity: z.coerce.number().int().positive("Must be greater than zero"),
  reasonCode: z.string().trim().min(1, "Reason is required"),
});

export const csvImportSchema = z.object({
  csv: z.string().trim().min(1, "Paste CSV rows to continue"),
  dryRun: z.enum(["on", "off"]).optional(),
});

export const resetPasswordSchema = z.object({
  id: positiveId,
  password: z.string().min(8, "Use at least 8 characters").max(200),
});

export const referenceActionSchema = z.object({
  kind: z.enum(["suppliers", "customers", "reasons", "categories"]),
  name: z.string().trim().min(1, "Name is required").max(120),
  id: z.string().optional(),
});
