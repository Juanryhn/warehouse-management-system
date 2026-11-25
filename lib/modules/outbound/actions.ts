"use server";

import { randomUUID } from "node:crypto";
import { ObjectId } from "mongodb";
import { updateTag } from "next/cache";
import { requireCapability } from "@/lib/auth/authorize";
import { getCollections, nextNumber } from "@/lib/db/ready";
import { EMPTY_FORM_STATE, toFormState, type FormState } from "@/lib/forms";
import type { OrderLine } from "@/lib/db/types";
import { orderLineSchema, orderSchema } from "@/lib/validation";
import { runStockTransaction, StockError } from "@/lib/modules/inventory/service";

const invalidate = () => {
  updateTag("stock");
  updateTag("orders");
};

export const createOrderAction = async (_previous: FormState, formData: FormData): Promise<FormState> => {
  try {
    const user = await requireCapability("operate");
    const input = orderSchema.parse(Object.fromEntries(formData.entries()));
    const { orders } = await getCollections();
    const number = await nextNumber(orders, "ORD");

    const result = await orders.insertOne({
      _id: new ObjectId(),
      number,
      customer: input.customer,
      status: "draft",
      lines: [{ id: randomUUID(), productId: input.productId, ordered: input.ordered, allocations: [] }],
      createdBy: user.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    invalidate();
    return { ...EMPTY_FORM_STATE, notice: `Order ${number} created.`, redirectTo: `/outbound/${result.insertedId.toHexString()}` };
  } catch (error) {
    return toFormState(error);
  }
};

export const addOrderLineAction = async (_previous: FormState, formData: FormData): Promise<FormState> => {
  try {
    await requireCapability("operate");
    const orderId = String(formData.get("orderId") ?? "");
    const input = orderSchema.parse(Object.fromEntries(formData.entries()));
    if (!ObjectId.isValid(orderId)) return { error: "Invalid order." };

    const { orders } = await getCollections();
    const order = await orders.findOne({ _id: new ObjectId(orderId) });
    if (!order || order.status !== "draft") return { error: "Lines can only be added to a draft order." };

    await orders.updateOne(
      { _id: order._id },
      {
        $push: { lines: { id: randomUUID(), productId: input.productId, ordered: input.ordered, allocations: [] } },
        $set: { updatedAt: new Date() },
      },
    );
    invalidate();
    return { ...EMPTY_FORM_STATE, notice: "Line added." };
  } catch (error) {
    return toFormState(error);
  }
};

export const allocateOrderAction = async (_previous: FormState, formData: FormData): Promise<FormState> => {
  try {
    const user = await requireCapability("operate");
    const input = orderLineSchema.parse(Object.fromEntries(formData.entries()));
    if (!ObjectId.isValid(input.orderId)) return { error: "Invalid order." };

    const { orders, stockLevels, locations } = await getCollections();
    const order = await orders.findOne({ _id: new ObjectId(input.orderId) });
    if (!order || !["draft", "allocated"].includes(order.status)) return { error: "This order cannot be allocated." };
    const line = order.lines.find((item) => item.id === input.lineId);
    if (!line) return { error: "Order line not found." };

    const allocated = line.allocations.reduce((sum, item) => sum + item.quantity, 0);
    const outstanding = line.ordered - allocated;
    if (outstanding <= 0) return { notice: "This line is already fully allocated." };

    const [levels, binDocs] = await Promise.all([
      stockLevels.find({ productId: line.productId }).toArray(),
      locations.find({ isActive: true, type: { $ne: "quarantine" } }).toArray(),
    ]);
    const codes = new Map(binDocs.map((bin) => [bin._id.toHexString(), bin.code]));
    const candidates = levels
      .map((level) => ({ level, available: level.onHand - level.reserved }))
      .filter((entry) => entry.available > 0 && codes.has(entry.level.locationId))
      .sort((left, right) => (codes.get(left.level.locationId) ?? "").localeCompare(codes.get(right.level.locationId) ?? ""));

    const fresh: OrderLine["allocations"] = [];
    let remaining = outstanding;
    for (const candidate of candidates) {
      if (remaining <= 0) break;
      const quantity = Math.min(remaining, candidate.available);
      fresh.push({ locationId: candidate.level.locationId, quantity, picked: 0 });
      remaining -= quantity;
    }
    if (fresh.length === 0) return { notice: "No stock is available to allocate right now." };

    await runStockTransaction(async (context) => {
      for (const allocation of fresh) {
        await context.adjustReserved({ productId: line.productId, locationId: allocation.locationId, delta: allocation.quantity });
      }
      const updatedLines = order.lines.map((item) =>
        item.id === line.id ? { ...item, allocations: [...item.allocations, ...fresh] as OrderLine["allocations"] } : item,
      );
      await context.db.collection("orders").updateOne(
        { _id: order._id },
        { $set: { lines: updatedLines, status: "allocated", updatedAt: new Date() } },
        { session: context.session },
      );
      await context.audit({
        actorId: user.id, action: "allocate-order", entityType: "order", entityId: order.number,
        detail: `${outstanding - remaining} units allocated`,
      });
    });

    invalidate();
    return { ...EMPTY_FORM_STATE, notice: remaining > 0 ? `${outstanding - remaining} allocated, ${remaining} backordered.` : "Stock allocated." };
  } catch (error) {
    return error instanceof StockError ? { error: error.message } : toFormState(error);
  }
};

export const pickOrderAction = async (_previous: FormState, formData: FormData): Promise<FormState> => {
  try {
    const user = await requireCapability("operate");
    const input = orderLineSchema.parse(Object.fromEntries(formData.entries()));
    if (!ObjectId.isValid(input.orderId)) return { error: "Invalid order." };

    const { orders } = await getCollections();
    const order = await orders.findOne({ _id: new ObjectId(input.orderId) });
    if (!order || order.status !== "allocated") return { error: "This order cannot be picked." };
    const line = order.lines.find((item) => item.id === input.lineId);
    if (!line || line.allocations.length === 0) return { error: "Allocate this line before picking." };

    const updatedLines = order.lines.map((item) =>
      item.id === line.id
        ? { ...item, allocations: item.allocations.map((allocation) => ({ ...allocation, picked: allocation.quantity })) }
        : item,
    );
    await orders.updateOne({ _id: order._id }, { $set: { lines: updatedLines, status: "picked", updatedAt: new Date() } });
    await (await getCollections()).auditLogs.insertOne({
      _id: new ObjectId(), actorId: user.id, action: "pick-order", entityType: "order",
      entityId: order.number, detail: line.id, createdAt: new Date(),
    });

    invalidate();
    return { ...EMPTY_FORM_STATE, notice: "Line picked." };
  } catch (error) {
    return toFormState(error);
  }
};

export const packOrderAction = async (_previous: FormState, formData: FormData): Promise<FormState> => {
  try {
    const user = await requireCapability("operate");
    const orderId = String(formData.get("orderId") ?? "");
    if (!ObjectId.isValid(orderId)) return { error: "Invalid order." };

    const { orders } = await getCollections();
    const order = await orders.findOne({ _id: new ObjectId(orderId) });
    if (!order || order.status !== "picked") return { error: "Pick all lines before packing." };
    const ready = order.lines.every((line) => line.allocations.length > 0 && line.allocations.every((allocation) => allocation.picked >= allocation.quantity));
    if (!ready) return { error: "Not all allocated units have been picked." };

    await orders.updateOne({ _id: order._id }, { $set: { status: "packed", updatedAt: new Date() } });
    await (await getCollections()).auditLogs.insertOne({
      _id: new ObjectId(), actorId: user.id, action: "pack-order", entityType: "order",
      entityId: order.number, detail: "Packed", createdAt: new Date(),
    });
    invalidate();
    return { ...EMPTY_FORM_STATE, notice: "Order packed and ready to ship." };
  } catch (error) {
    return toFormState(error);
  }
};

export const shipOrderAction = async (_previous: FormState, formData: FormData): Promise<FormState> => {
  try {
    const user = await requireCapability("operate");
    const orderId = String(formData.get("orderId") ?? "");
    if (!ObjectId.isValid(orderId)) return { error: "Invalid order." };

    const { orders } = await getCollections();
    const order = await orders.findOne({ _id: new ObjectId(orderId) });
    if (!order || order.status !== "packed") return { error: "Only packed orders can be shipped." };

    await runStockTransaction(async (context) => {
      for (const line of order.lines) {
        for (const allocation of line.allocations) {
          if (allocation.picked <= 0) continue;
          await context.apply([{
            type: "ship",
            productId: line.productId,
            locationId: allocation.locationId,
            quantity: -allocation.picked,
            referenceType: "order",
            referenceId: order.number,
            lineId: `${line.id}:${allocation.locationId}`,
            reasonCode: "",
            actorId: user.id,
          }]);
          await context.adjustReserved({ productId: line.productId, locationId: allocation.locationId, delta: -allocation.quantity });
        }
      }
      await context.db.collection("orders").updateOne(
        { _id: order._id },
        { $set: { status: "shipped", updatedAt: new Date() } },
        { session: context.session },
      );
      await context.audit({
        actorId: user.id, action: "ship-order", entityType: "order", entityId: order.number, detail: "Shipped",
      });
    });

    invalidate();
    return { ...EMPTY_FORM_STATE, notice: "Order shipped. Stock and reservations updated." };
  } catch (error) {
    return error instanceof StockError ? { error: error.message } : toFormState(error);
  }
};

export const cancelOrderAction = async (_previous: FormState, formData: FormData): Promise<FormState> => {
  try {
    const user = await requireCapability("cancel");
    const orderId = String(formData.get("orderId") ?? "");
    if (!ObjectId.isValid(orderId)) return { error: "Invalid order." };

    const { orders } = await getCollections();
    const order = await orders.findOne({ _id: new ObjectId(orderId) });
    if (!order || ["shipped", "cancelled"].includes(order.status)) return { error: "This order cannot be cancelled." };

    await runStockTransaction(async (context) => {
      for (const line of order.lines) {
        for (const allocation of line.allocations) {
          await context.adjustReserved({ productId: line.productId, locationId: allocation.locationId, delta: -allocation.quantity });
        }
      }
      await context.db.collection("orders").updateOne(
        { _id: order._id },
        { $set: { status: "cancelled", updatedAt: new Date() } },
        { session: context.session },
      );
      await context.audit({
        actorId: user.id, action: "cancel-order", entityType: "order", entityId: order.number, detail: "Cancelled",
      });
    });

    invalidate();
    return { ...EMPTY_FORM_STATE, notice: "Order cancelled. Reservations released." };
  } catch (error) {
    return error instanceof StockError ? { error: error.message } : toFormState(error);
  }
};
