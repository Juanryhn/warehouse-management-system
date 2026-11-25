"use server";

import { randomUUID } from "node:crypto";
import { ObjectId } from "mongodb";
import { updateTag } from "next/cache";
import { requireCapability } from "@/lib/auth/authorize";
import { getCollections, nextNumber } from "@/lib/db/ready";
import { EMPTY_FORM_STATE, toFormState, type FormState } from "@/lib/forms";
import { adjustmentSchema, transferSchema } from "@/lib/validation";
import { needsApproval, runStockTransaction, StockError } from "./service";

const invalidate = () => {
  updateTag("stock");
  updateTag("products");
};

export const createAdjustmentAction = async (_previous: FormState, formData: FormData): Promise<FormState> => {
  try {
    const user = await requireCapability("operate");
    const input = adjustmentSchema.parse(Object.fromEntries(formData.entries()));
    const { adjustments, auditLogs } = await getCollections();

    if (needsApproval(input.quantity)) {
      await adjustments.insertOne({
        _id: new ObjectId(),
        number: await nextNumber(adjustments, "ADJ"),
        productId: input.productId,
        locationId: input.locationId,
        quantity: input.quantity,
        reasonCode: input.reasonCode,
        status: "pending",
        requestedBy: user.id,
        approvedBy: "",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await auditLogs.insertOne({
        _id: new ObjectId(), actorId: user.id, action: "request-adjustment", entityType: "adjustment",
        entityId: input.productId, detail: `${input.quantity} · ${input.reasonCode}`, createdAt: new Date(),
      });
      invalidate();
      return { ...EMPTY_FORM_STATE, notice: "Adjustment requested. A manager must approve it." };
    }

    await runStockTransaction(async (context) => {
      await context.assertNoActiveCount(input.locationId);
      await context.apply([{
        type: "adjustment",
        productId: input.productId,
        locationId: input.locationId,
        quantity: input.quantity,
        referenceType: "adjustment",
        referenceId: "direct",
        lineId: randomUUID(),
        reasonCode: input.reasonCode,
        actorId: user.id,
      }]);
      await context.audit({
        actorId: user.id, action: "post-adjustment", entityType: "adjustment",
        entityId: input.productId, detail: `${input.quantity} · ${input.reasonCode}`,
      });
    });

    invalidate();
    return { ...EMPTY_FORM_STATE, notice: "Adjustment posted." };
  } catch (error) {
    return error instanceof StockError ? { error: error.message } : toFormState(error);
  }
};

export const approveAdjustmentAction = async (_previous: FormState, formData: FormData): Promise<FormState> => {
  try {
    const user = await requireCapability("approve");
    const id = String(formData.get("id") ?? "");
    if (!ObjectId.isValid(id)) return { error: "Invalid adjustment." };

    const { adjustments } = await getCollections();
    const adjustment = await adjustments.findOne({ _id: new ObjectId(id), status: "pending" });
    if (!adjustment) return { error: "Adjustment is no longer pending." };

    await runStockTransaction(async (context) => {
      await context.assertNoActiveCount(adjustment.locationId);
      await context.apply([{
        type: "adjustment",
        productId: adjustment.productId,
        locationId: adjustment.locationId,
        quantity: adjustment.quantity,
        referenceType: "adjustment",
        referenceId: adjustment.number,
        lineId: adjustment._id.toHexString(),
        reasonCode: adjustment.reasonCode,
        actorId: user.id,
      }]);
      await context.db.collection("adjustments").updateOne(
        { _id: adjustment._id, status: "pending" },
        { $set: { status: "approved", approvedBy: user.id, updatedAt: new Date() } },
        { session: context.session },
      );
      await context.audit({
        actorId: user.id, action: "approve-adjustment", entityType: "adjustment",
        entityId: id, detail: adjustment.number,
      });
    });

    invalidate();
    return { ...EMPTY_FORM_STATE, notice: "Adjustment approved and posted." };
  } catch (error) {
    return error instanceof StockError ? { error: error.message } : toFormState(error);
  }
};

export const rejectAdjustmentAction = async (_previous: FormState, formData: FormData): Promise<FormState> => {
  try {
    const user = await requireCapability("approve");
    const id = String(formData.get("id") ?? "");
    if (!ObjectId.isValid(id)) return { error: "Invalid adjustment." };

    const { adjustments } = await getCollections();
    const result = await adjustments.updateOne(
      { _id: new ObjectId(id), status: "pending" },
      { $set: { status: "rejected", approvedBy: user.id, updatedAt: new Date() } },
    );
    if (result.matchedCount === 0) return { error: "Adjustment is no longer pending." };

    invalidate();
    return { ...EMPTY_FORM_STATE, notice: "Adjustment rejected. Stock was not changed." };
  } catch (error) {
    return toFormState(error);
  }
};

export const transferStockAction = async (_previous: FormState, formData: FormData): Promise<FormState> => {
  try {
    const user = await requireCapability("operate");
    const input = transferSchema.parse(Object.fromEntries(formData.entries()));
    if (input.fromLocationId === input.toLocationId) return { error: "Source and destination bins must differ." };

    const referenceId = `TRF-${Date.now().toString(36).toUpperCase()}`;
    const lineId = randomUUID();

    await runStockTransaction(async (context) => {
      await context.assertNoActiveCount(input.fromLocationId);
      await context.assertNoActiveCount(input.toLocationId);
      await context.apply([
        {
          type: "transfer", productId: input.productId, locationId: input.fromLocationId,
          quantity: -input.quantity, referenceType: "transfer", referenceId, lineId,
          reasonCode: input.reasonCode, actorId: user.id,
          fromLocationId: input.fromLocationId, toLocationId: input.toLocationId,
        },
        {
          type: "transfer", productId: input.productId, locationId: input.toLocationId,
          quantity: input.quantity, referenceType: "transfer", referenceId, lineId,
          reasonCode: input.reasonCode, actorId: user.id,
          fromLocationId: input.fromLocationId, toLocationId: input.toLocationId,
        },
      ]);
      await context.audit({
        actorId: user.id, action: "transfer-stock", entityType: "stock", entityId: input.productId,
        detail: `${input.quantity} units · ${referenceId}`,
      });
    });

    invalidate();
    return { ...EMPTY_FORM_STATE, notice: `Transfer ${referenceId} posted.` };
  } catch (error) {
    return error instanceof StockError ? { error: error.message } : toFormState(error);
  }
};
