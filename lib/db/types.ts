import type { ObjectId } from "mongodb";

export type Role = "admin" | "manager" | "operator" | "viewer";
export type LocationType = "receiving" | "storage" | "picking" | "quarantine";
export type MovementType =
  | "receipt"
  | "putaway"
  | "pick"
  | "ship"
  | "transfer"
  | "adjustment"
  | "count";

export interface UserDoc {
  _id: ObjectId;
  email: string;
  name: string;
  role: Role;
  passwordHash: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionDoc {
  _id: ObjectId;
  tokenHash: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface WarehouseDoc {
  _id: ObjectId;
  code: string;
  name: string;
  address: string;
  isActive: boolean;
}

export interface LocationDoc {
  _id: ObjectId;
  warehouseId: string;
  code: string;
  zone: string;
  type: LocationType;
  isActive: boolean;
}

export interface CategoryDoc {
  _id: ObjectId;
  name: string;
  isActive: boolean;
}

export interface NamedRefDoc {
  _id: ObjectId;
  name: string;
  isActive: boolean;
}

export interface ProductDoc {
  _id: ObjectId;
  sku: string;
  barcode: string;
  name: string;
  categoryId: string;
  uom: string;
  minStock: number;
  description: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface StockLevelDoc {
  _id: ObjectId;
  productId: string;
  locationId: string;
  warehouseId: string;
  onHand: number;
  reserved: number;
  version: number;
  updatedAt: Date;
}

export interface MovementDoc {
  _id: ObjectId;
  type: MovementType;
  productId: string;
  locationId: string;
  fromLocationId: string;
  toLocationId: string;
  quantity: number;
  referenceType: string;
  referenceId: string;
  lineId: string;
  reasonCode: string;
  actorId: string;
  uniqueKey: string;
  createdAt: Date;
}

export interface AdjustmentDoc {
  _id: ObjectId;
  number: string;
  productId: string;
  locationId: string;
  quantity: number;
  reasonCode: string;
  status: "pending" | "approved" | "rejected";
  requestedBy: string;
  approvedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReceiptLine {
  id: string;
  productId: string;
  expected: number;
  received: number;
  locationId: string;
}

export interface ReceiptDoc {
  _id: ObjectId;
  number: string;
  supplier: string;
  status: "draft" | "partial" | "posted" | "cancelled";
  lines: ReceiptLine[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderAllocation {
  locationId: string;
  quantity: number;
  picked: number;
}

export interface OrderLine {
  id: string;
  productId: string;
  ordered: number;
  allocations: OrderAllocation[];
}

export interface OrderDoc {
  _id: ObjectId;
  number: string;
  customer: string;
  status: "draft" | "allocated" | "picked" | "packed" | "shipped" | "cancelled";
  lines: OrderLine[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CountLine {
  id: string;
  productId: string;
  locationId: string;
  expected: number;
  counted: number | null;
}

export interface CountDoc {
  _id: ObjectId;
  number: string;
  scopeType: "bin" | "zone";
  scopeValue: string;
  status: "draft" | "counted" | "approved" | "rejected";
  lines: CountLine[];
  countedBy: string;
  approvedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditDoc {
  _id: ObjectId;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  detail: string;
  createdAt: Date;
}

export interface DbCollections {
  users: import("mongodb").Collection<UserDoc>;
  sessions: import("mongodb").Collection<SessionDoc>;
  warehouses: import("mongodb").Collection<WarehouseDoc>;
  locations: import("mongodb").Collection<LocationDoc>;
  categories: import("mongodb").Collection<CategoryDoc>;
  products: import("mongodb").Collection<ProductDoc>;
  stockLevels: import("mongodb").Collection<StockLevelDoc>;
  stockMovements: import("mongodb").Collection<MovementDoc>;
  adjustments: import("mongodb").Collection<AdjustmentDoc>;
  receipts: import("mongodb").Collection<ReceiptDoc>;
  orders: import("mongodb").Collection<OrderDoc>;
  counts: import("mongodb").Collection<CountDoc>;
  suppliers: import("mongodb").Collection<NamedRefDoc>;
  customers: import("mongodb").Collection<NamedRefDoc>;
  reasons: import("mongodb").Collection<NamedRefDoc>;
  auditLogs: import("mongodb").Collection<AuditDoc>;
}
