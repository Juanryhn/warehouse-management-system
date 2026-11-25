"use server";

import { randomUUID } from "node:crypto";
import { ObjectId } from "mongodb";
import { updateTag } from "next/cache";
import { requireCapability } from "@/lib/auth/authorize";
import { getCollections, nextNumber } from "@/lib/db/ready";
import { EMPTY_FORM_STATE, toFormState, type FormState } from "@/lib/forms";
import { countLineSchema, countSchema } from "@/lib/validation";
import { runStockTransaction } from "@/lib/modules/inventory/service";

const invalidate = () => {
  updateTag("stock");
  updateTag("counts");
};

export const createCountAction = async (_previous: FormState, formData: FormData): Promise<FormState> => {
  try {
    const user = await requireCapability("operate");
    const input = countSchema.parse(Object.fromEntries(formData.entries()));
    const { counts, locations, stockLevels } = await getCollections();

    let locationIds: string[];
    if (input.scopeType === "bin") {
      if (!ObjectId.isValid(input.scopeValue)) return { error: "Select a valid bin." };
      locationIds = [input.scopeValue];
    } else {
      const docs = await locations.find({ zone: input.scopeValue }).toArray();
      if (docs.length === 0) return { error: "No bins found in that zone." };
      locationIds = docs.map((doc) => doc._id.toHexString());
    }

    const levels = await stockLevels.find({ locationId: { $in: locationIds } }).toArray();
    if (levels.length === 0) return { error: "There is no stock to count in this scope." };

    const number = await nextNumber(counts, "CNT");
    const result = await counts.insertOne({
      _id: new ObjectId(),
      number,
      scopeType: input.scopeType,
      scopeValue: input.scopeValue,
      status: "draft",
      lines: levels.map((level) => ({
        id: randomUUID(),
        productId: level.productId,
        locationId: level.locationId,
        expected: level.onHand,
        counted: null,
      })),
      countedBy: user.id,
      approvedBy: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    invalidate();
    return { ...EMPTY_FORM_STATE, notice: `Count ${number} created.`, redirectTo: `/counts/${result.insertedId.toHexString()}` };
  } catch (error) {
    return toFormState(error);
  }
};

export const enterCountAction = async (_previous: FormState, formData: FormData): Promise<FormState> => {
  try {
    await requireCapability("operate");
    const input = countLineSchema.parse(Object.fromEntries(formData.entries()));
    const { counts } = await getCollections();
    const count = await counts.findOne({ _id: new ObjectId(input.countId) });
    if (!count || !["draft", "counted"].includes(count.status)) return { error: "This count can no longer be edited." };

    const lines = count.lines.map((line) => (line.id === input.lineId ? { ...line, counted: input.counted } : line));
    const complete = lines.every((line) => line.counted !== null);
    await counts.updateOne(
      { _id: count._id },
      { $set: { lines, status: complete ? "counted" : "draft", updatedAt: new Date() } },
    );

    invalidate();
    return { ...EMPTY_FORM_STATE, notice: complete ? "All lines counted. Ready for approval." : "Count recorded." };
  } catch (error) {
    return toFormState(error);
  }
};

export const approveCountAction = async (_previous: FormState, formData: FormData): Promise<FormState> => {
  try {
    const user = await requireCapability("approve");
    const id = String(formData.get("id") ?? "");
    if (!ObjectId.isValid(id)) return { error: "Invalid count." };

    const { counts } = await getCollections();
    const count = await counts.findOne({ _id: new ObjectId(id), status: "counted" });
    if (!count) return { error: "Only a fully counted, unapproved count can be approved." };

    const variances = count.lines.filter((line) => line.counted !== null && line.counted !== line.expected);

    await runStockTransaction(async (context) => {
      for (const line of variances) {
        await context.apply([{
          type: "count",
          productId: line.productId,
          locationId: line.locationId,
          quantity: line.counted! - line.expected,
          referenceType: "count",
          referenceId: count.number,
          lineId: line.id,
          reasonCode: "Cycle count",
          actorId: user.id,
        }]);
      }
      await context.db.collection("counts").updateOne(
        { _id: count._id, status: "counted" },
        { $set: { status: "approved", approvedBy: user.id, updatedAt: new Date() } },
        { session: context.session },
      );
      await context.audit({
        actorId: user.id, action: "approve-count", entityType: "count", entityId: count.number,
        detail: `${variances.length} variance line(s) posted`,
      });
    });

    invalidate();
    return { ...EMPTY_FORM_STATE, notice: `Approved. ${variances.length} adjustment movement(s) posted.` };
  } catch (error) {
    return toFormState(error);
  }
};

export const rejectCountAction = async (_previous: FormState, formData: FormData): Promise<FormState> => {
  try {
    const user = await requireCapability("approve");
    const id = String(formData.get("id") ?? "");
    if (!ObjectId.isValid(id)) return { error: "Invalid count." };

    const { counts, auditLogs } = await getCollections();
    const result = await counts.updateOne(
      { _id: new ObjectId(id), status: "counted" },
      { $set: { status: "rejected", approvedBy: user.id, updatedAt: new Date() } },
    );
    if (result.matchedCount === 0) return { error: "Only a fully counted, unapproved count can be rejected." };

    await auditLogs.insertOne({
      _id: new ObjectId(), actorId: user.id, action: "reject-count", entityType: "count",
      entityId: id, detail: "Variance rejected; stock unchanged", createdAt: new Date(),
    });

    invalidate();
    return { ...EMPTY_FORM_STATE, notice: "Count rejected. Stock was not changed." };
  } catch (error) {
    return toFormState(error);
  }
};
