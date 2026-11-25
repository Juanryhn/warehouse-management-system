"use server";

import { randomUUID } from "node:crypto";
import { ObjectId } from "mongodb";
import { updateTag } from "next/cache";
import { requireCapability } from "@/lib/auth/authorize";
import { getCollections, nextNumber } from "@/lib/db/ready";
import { EMPTY_FORM_STATE, toFormState, type FormState } from "@/lib/forms";
import { receiptSchema, receiveSchema } from "@/lib/validation";
import { runStockTransaction, StockError } from "@/lib/modules/inventory/service";

const invalidate = () => {
  updateTag("stock");
  updateTag("receipts");
  updateTag("products");
};

const editableStatuses = ["draft", "partial"];

export const createReceiptAction = async (_previous: FormState, formData: FormData): Promise<FormState> => {
  try {
    const user = await requireCapability("operate");
    const input = receiptSchema.parse(Object.fromEntries(formData.entries()));
    const { receipts } = await getCollections();
    const number = await nextNumber(receipts, "RCP");

    const result = await receipts.insertOne({
      _id: new ObjectId(),
      number,
      supplier: input.supplier,
      status: "draft",
      lines: [{ id: randomUUID(), productId: input.productId, expected: input.expected, received: 0, locationId: "" }],
      createdBy: user.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    invalidate();
    return { ...EMPTY_FORM_STATE, notice: `Receipt ${number} created.`, redirectTo: `/inbound/${result.insertedId.toHexString()}` };
  } catch (error) {
    return toFormState(error);
  }
};

export const addReceiptLineAction = async (_previous: FormState, formData: FormData): Promise<FormState> => {
  try {
    await requireCapability("operate");
    const receiptId = String(formData.get("receiptId") ?? "");
    const input = receiptSchema.parse(Object.fromEntries(formData.entries()));
    if (!ObjectId.isValid(receiptId)) return { error: "Invalid receipt." };

    const { receipts } = await getCollections();
    const receipt = await receipts.findOne({ _id: new ObjectId(receiptId) });
    if (!receipt || !editableStatuses.includes(receipt.status)) return { error: "This receipt cannot be changed." };

    await receipts.updateOne(
      { _id: receipt._id },
      {
        $push: { lines: { id: randomUUID(), productId: input.productId, expected: input.expected, received: 0, locationId: "" } },
        $set: { updatedAt: new Date() },
      },
    );

    invalidate();
    return { ...EMPTY_FORM_STATE, notice: "Line added." };
  } catch (error) {
    return toFormState(error);
  }
};

export const receiveLineAction = async (_previous: FormState, formData: FormData): Promise<FormState> => {
  try {
    const user = await requireCapability("operate");
    const input = receiveSchema.parse(Object.fromEntries(formData.entries()));
    const { receipts, locations } = await getCollections();

    const [receipt, location] = await Promise.all([
      receipts.findOne({ _id: new ObjectId(input.receiptId) }),
      locations.findOne({ _id: new ObjectId(input.locationId) }),
    ]);
    if (!receipt || !editableStatuses.includes(receipt.status)) return { error: "This receipt cannot receive stock." };
    if (!location?.isActive) return { error: "Select an active bin." };
    if (location.type === "quarantine") return { error: "Quarantine bins are not used for putaway." };

    const line = receipt.lines.find((item) => item.id === input.lineId);
    if (!line) return { error: "Receipt line not found." };
    if (input.quantity > line.expected - line.received) return { error: "Quantity exceeds the outstanding expected quantity." };

    await runStockTransaction(async (context) => {
      await context.apply([{
        type: "receipt",
        productId: line.productId,
        locationId: input.locationId,
        quantity: input.quantity,
        referenceType: "receipt",
        referenceId: receipt.number,
        lineId: `${line.id}:${randomUUID()}`,
        reasonCode: "",
        actorId: user.id,
      }]);

      const updatedLines = receipt.lines.map((item) =>
        item.id === line.id
          ? { ...item, received: item.received + input.quantity, locationId: input.locationId }
          : item,
      );
      const complete = updatedLines.every((item) => item.received >= item.expected);
      await context.db.collection("receipts").updateOne(
        { _id: receipt._id },
        { $set: { lines: updatedLines, status: complete ? "posted" : "partial", updatedAt: new Date() } },
        { session: context.session },
      );
      await context.audit({
        actorId: user.id, action: "receive-stock", entityType: "receipt", entityId: receipt.number,
        detail: `${input.quantity} units into ${location.code}`,
      });
    });

    invalidate();
    return { ...EMPTY_FORM_STATE, notice: "Stock received and put away." };
  } catch (error) {
    return error instanceof StockError ? { error: error.message } : toFormState(error);
  }
};

export const cancelReceiptAction = async (_previous: FormState, formData: FormData): Promise<FormState> => {
  try {
    const user = await requireCapability("cancel");
    const receiptId = String(formData.get("receiptId") ?? "");
    if (!ObjectId.isValid(receiptId)) return { error: "Invalid receipt." };

    const { receipts } = await getCollections();
    const receipt = await receipts.findOne({ _id: new ObjectId(receiptId) });
    if (!receipt || !editableStatuses.includes(receipt.status)) return { error: "Only open receipts can be cancelled." };
    if (receipt.lines.some((line) => line.received > 0)) return { error: "This receipt has received stock and cannot be cancelled." };

    await receipts.updateOne({ _id: receipt._id }, { $set: { status: "cancelled", updatedAt: new Date() } });
    await (await getCollections()).auditLogs.insertOne({
      _id: new ObjectId(), actorId: user.id, action: "cancel-receipt", entityType: "receipt",
      entityId: receipt.number, detail: "Draft cancelled", createdAt: new Date(),
    });

    invalidate();
    return { ...EMPTY_FORM_STATE, notice: "Receipt cancelled.", redirectTo: "/inbound" };
  } catch (error) {
    return toFormState(error);
  }
};
