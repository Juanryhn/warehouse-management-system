import "server-only";
import { getCurrentUser, requireUser, type SessionUser } from "./session";
import type { Role } from "@/lib/db/types";

export type Capability =
  | "operate"
  | "cancel"
  | "approve"
  | "manageCatalog"
  | "manageUsers"
  | "export";

const MATRIX: Record<Role, Capability[]> = {
  admin: ["operate", "cancel", "approve", "manageCatalog", "manageUsers", "export"],
  manager: ["operate", "cancel", "approve", "manageCatalog", "export"],
  operator: ["operate"],
  viewer: ["export"],
};

export const can = (role: Role, capability: Capability): boolean => MATRIX[role].includes(capability);

export const hasCapability = async (capability: Capability): Promise<boolean> => {
  const user = await getCurrentUser();
  return user ? can(user.role, capability) : false;
};

export const requireCapability = async (capability: Capability): Promise<SessionUser> => {
  const user = await requireUser();
  if (!can(user.role, capability)) {
    throw new (await import("./session")).AuthError("You do not have permission for this action.", 403);
  }
  return user;
};
