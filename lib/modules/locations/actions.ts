"use server";

import { ObjectId } from "mongodb";
import { updateTag } from "next/cache";
import { requireCapability } from "@/lib/auth/authorize";
import { getCollections } from "@/lib/db/ready";
import { EMPTY_FORM_STATE, toFormState, type FormState } from "@/lib/forms";
import { locationSchema } from "@/lib/validation";

const invalidate = () => updateTag("locations");

export const saveLocationAction = async (_previous: FormState, formData: FormData): Promise<FormState> => {
  try {
    const user = await requireCapability("manageCatalog");
    const id = String(formData.get("id") ?? "");
    const input = locationSchema.parse(Object.fromEntries(formData.entries()));
    const { locations, warehouses, auditLogs } = await getCollections();
    const warehouse = await warehouses.findOne({ code: "MAIN" });
    if (!warehouse) return { error: "Warehouse is not configured." };

    const values = {
      code: input.code.toUpperCase(),
      zone: input.zone,
      type: input.type,
      isActive: input.isActive === "on",
    };

    if (id && ObjectId.isValid(id)) {
      await locations.updateOne({ _id: new ObjectId(id) }, { $set: values });
    } else {
      await locations.insertOne({ ...values, _id: new ObjectId(), warehouseId: warehouse._id.toHexString() });
    }
    await auditLogs.insertOne({
      _id: new ObjectId(), actorId: user.id, action: id ? "update-location" : "create-location",
      entityType: "location", entityId: id || values.code, detail: values.code, createdAt: new Date(),
    });

    invalidate();
    return { ...EMPTY_FORM_STATE, notice: "Location saved.", redirectTo: "/locations" };
  } catch (error) {
    return toFormState(error);
  }
};

export const setLocationStatusAction = async (_previous: FormState, formData: FormData): Promise<FormState> => {
  try {
    const user = await requireCapability("manageCatalog");
    const id = String(formData.get("id") ?? "");
    const status = String(formData.get("status") ?? "");
    if (!ObjectId.isValid(id)) return { error: "Invalid location." };

    const { locations, stockLevels, auditLogs } = await getCollections();
    if (status === "inactive") {
      const occupied = await stockLevels.countDocuments({ locationId: id, onHand: { $gt: 0 } });
      if (occupied > 0) return { error: "This bin still holds stock and cannot be deactivated." };
    }

    await locations.updateOne({ _id: new ObjectId(id) }, { $set: { isActive: status === "active" } });
    await auditLogs.insertOne({
      _id: new ObjectId(), actorId: user.id, action: "set-location-status", entityType: "location",
      entityId: id, detail: status, createdAt: new Date(),
    });

    invalidate();
    return { ...EMPTY_FORM_STATE, notice: `Location ${status === "active" ? "activated" : "deactivated"}.`, redirectTo: "/locations" };
  } catch (error) {
    return toFormState(error);
  }
};
