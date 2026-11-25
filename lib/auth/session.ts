import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { ObjectId } from "mongodb";
import { cacheLife } from "next/cache";
import { cookies } from "next/headers";
import { getCollections } from "@/lib/db/ready";
import type { Role } from "@/lib/db/types";
import { env } from "@/lib/env";

export { SESSION_COOKIE } from "./constants";
import { SESSION_COOKIE } from "./constants";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403,
  ) {
    super(message);
  }
}

const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");

export const createSession = async (userId: string): Promise<void> => {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + env.SESSION_DAYS * 24 * 60 * 60 * 1000);
  const { sessions } = await getCollections();

  await sessions.insertOne({
    _id: new ObjectId(),
    tokenHash: hashToken(token),
    userId,
    expiresAt,
    createdAt: new Date(),
  });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
};

// Private cache deduplicates the session read inside a request without ever
// placing user-specific data in the shared static shell or server cache.
export const getCurrentUser = async (): Promise<SessionUser | null> => {
  "use cache: private";
  cacheLife({ stale: Infinity });

  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const { sessions, users } = await getCollections();
  const session = await sessions.findOne({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } });
  if (!session) return null;

  const user = await users.findOne({ _id: new ObjectId(session.userId), isActive: true });
  if (!user) return null;

  return { id: user._id.toHexString(), email: user.email, name: user.name, role: user.role };
};

export const requireUser = async (): Promise<SessionUser> => {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Sign in required.", 401);
  return user;
};

export const requireRole = async (...roles: Role[]): Promise<SessionUser> => {
  const user = await requireUser();
  if (!roles.includes(user.role)) throw new AuthError("You do not have permission for this action.", 403);
  return user;
};

export const destroyCurrentSession = async (): Promise<void> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) {
    const { sessions } = await getCollections();
    await sessions.deleteOne({ tokenHash: hashToken(token) });
  }
  (await cookies()).delete(SESSION_COOKIE);
};

export const destroyAllSessions = async (userId: string): Promise<void> => {
  const { sessions } = await getCollections();
  await sessions.deleteMany({ userId });
};

export const verifyCredentials = async (email: string, password: string) => {
  const { users } = await getCollections();
  const user = await users.findOne({ email: email.trim().toLowerCase() });
  if (!user || !user.isActive) return null;

  const { verifyPassword, needsRehash } = await import("./password");
  if (!(await verifyPassword(password, user.passwordHash))) return null;

  if (needsRehash(user.passwordHash)) {
    const { hashPassword } = await import("./password");
    user.passwordHash = await hashPassword(password);
    user.updatedAt = new Date();
    await users.replaceOne({ _id: user._id }, user);
  }

  return { id: user._id.toHexString(), name: user.name, role: user.role };
};
