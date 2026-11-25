import "server-only";
import { MongoClient, type Db } from "mongodb";
import { env } from "@/lib/env";
import { startLocalDatabase } from "./local";

const state = globalThis as unknown as { wmsDatabase?: Promise<Db> };

const connect = async (): Promise<Db> => {
  if (env.MONGODB_URI) {
    const client = new MongoClient(env.MONGODB_URI);
    await client.connect();
    return client.db(env.MONGODB_DB);
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("MONGODB_URI must be set in production.");
  }

  const replicaSet = await startLocalDatabase();
  const client = new MongoClient(replicaSet.getUri());
  await client.connect();
  return client.db(env.MONGODB_DB);
};

export const getDb = (): Promise<Db> => (state.wmsDatabase ??= connect());
