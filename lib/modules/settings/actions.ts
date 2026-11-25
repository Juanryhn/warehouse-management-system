"use server";

import { ObjectId } from "mongodb";
import { updateTag } from "next/cache";
import { requireCapability } from "@/lib/auth/authorize";
import { hashPassword } from "@/lib/auth/password";
import { getCollections } from "@/lib/db/ready";
import { EMPTY_FORM_STATE, toFormState, type FormState } from "@/lib/forms";
import { referenceActionSchema, resetPasswordSchema, userSchema } from "@/lib/validation";
import type { ReferenceKind } from "./queries";

const referenceCollections = {
  suppliers: "suppliers",
  customers: "customers",
  reasons: "reasons",
  categories: "categories",
} as const;

export const createUserAction = async (_previous: FormState, formData: FormData): Promise<FormState> => {
  try {
    const actor = await requireCapability("manageUsers");
    const input = userSchema.parse(Object.fromEntries(formData.entries()));
    const { users, auditLogs } = await getCollections();

    const result = await users.insertOne({
      _id: new ObjectId(),
      email: input.email.toLowerCase(),
      name: input.name,
      role: input.role,
      passwordHash: await hashPassword(input.password),
      isActive: input.isActive === "on",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await auditLogs.insertOne({
      _id: new ObjectId(), actorId: actor.id, action: "create-user", entityType: "user",
      entityId: result.insertedId.toHexString(), detail: input.email, createdAt: new Date(),
    });

    updateTag("users");
    return { ...EMPTY_FORM_STATE, notice: `User ${input.email} created.` };
  } catch (error) {
    return toFormState(error);
  }
};

export const setUserStatusAction = async (_previous: FormState, formData: FormData): Promise<FormState> => {
  try {
    const actor = await requireCapability("manageUsers");
    const id = String(formData.get("id") ?? "");
    const status = String(formData.get("status") ?? "");
    if (!ObjectId.isValid(id) || id === actor.id) return { error: "You cannot change your own account status." };

    const { users, sessions, auditLogs } = await getCollections();
    const target = await users.findOne({ _id: new ObjectId(id) });
    if (!target) return { error: "User not found." };

    const isActive = status === "active";
    await users.updateOne({ _id: target._id }, { $set: { isActive, updatedAt: new Date() } });
    if (!isActive) await sessions.deleteMany({ userId: id });
    await auditLogs.insertOne({
      _id: new ObjectId(), actorId: actor.id, action: isActive ? "activate-user" : "deactivate-user",
      entityType: "user", entityId: id, detail: target.email, createdAt: new Date(),
    });

    updateTag("users");
    return { ...EMPTY_FORM_STATE, notice: isActive ? "User activated." : "User deactivated and sessions ended." };
  } catch (error) {
    return toFormState(error);
  }
};

export const resetPasswordAction = async (_previous: FormState, formData: FormData): Promise<FormState> => {
  try {
    const actor = await requireCapability("manageUsers");
    const input = resetPasswordSchema.parse(Object.fromEntries(formData.entries()));
    const { users, sessions, auditLogs } = await getCollections();
    const user = await users.findOne({ _id: new ObjectId(input.id) });
    if (!user) return { error: "User not found." };

    await users.updateOne(
      { _id: user._id },
      { $set: { passwordHash: await hashPassword(input.password), updatedAt: new Date() } },
    );
    await sessions.deleteMany({ userId: input.id });
    await auditLogs.insertOne({
      _id: new ObjectId(), actorId: actor.id, action: "reset-password", entityType: "user",
      entityId: input.id, detail: user.email, createdAt: new Date(),
    });

    updateTag("users");
    return { ...EMPTY_FORM_STATE, notice: "Password reset. All sessions for this user were ended." };
  } catch (error) {
    return toFormState(error);
  }
};

export const saveReferenceAction = async (_previous: FormState, formData: FormData): Promise<FormState> => {
  try {
    const actor = await requireCapability("manageCatalog");
    const input = referenceActionSchema.parse(Object.fromEntries(formData.entries()));
    const { auditLogs } = await getCollections();
    const target = (await getCollections())[input.kind as ReferenceKind];

    if (input.id && ObjectId.isValid(input.id)) {
      await target.updateOne({ _id: new ObjectId(input.id) }, { $set: { name: input.name } });
    } else {
      await target.insertOne({ _id: new ObjectId(), name: input.name, isActive: true });
    }
    await auditLogs.insertOne({
      _id: new ObjectId(), actorId: actor.id, action: "save-reference", entityType: input.kind,
      entityId: input.id || input.name, detail: input.name, createdAt: new Date(),
    });

    updateTag("reference");
    return { ...EMPTY_FORM_STATE, notice: "Reference value saved." };
  } catch (error) {
    return toFormState(error);
  }
};

export const toggleReferenceAction = async (_previous: FormState, formData: FormData): Promise<FormState> => {
  try {
    await requireCapability("manageCatalog");
    const kind = String(formData.get("kind") ?? "");
    const id = String(formData.get("id") ?? "");
    if (!(kind in referenceCollections) || !ObjectId.isValid(id)) return { error: "Invalid reference value." };

    const db = await getCollections();
    const target = db[kind as ReferenceKind];
    const doc = await target.findOne({ _id: new ObjectId(id) });
    if (!doc) return { error: "Reference value not found." };

    await target.updateOne({ _id: doc._id }, { $set: { isActive: !doc.isActive } });
    updateTag("reference");
    return { ...EMPTY_FORM_STATE, notice: doc.isActive ? "Value deactivated." : "Value activated." };
  } catch (error) {
    return toFormState(error);
  }
};
