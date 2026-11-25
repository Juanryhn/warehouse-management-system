import "server-only";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { MongoMemoryReplSet } from "mongodb-memory-server";

const local = globalThis as unknown as { wmsLocalReplicaSet?: Promise<MongoMemoryReplSet> };

// A single-node replica set gives local development the same transaction guarantee as Atlas.
// Data lives in the OS temp folder so build tools never trace (or lock) database files.
export const startLocalDatabase = (): Promise<MongoMemoryReplSet> =>
  (local.wmsLocalReplicaSet ??= (async () => {
    const dbPath = path.join(os.tmpdir(), "wms-data", "mongo");
    fs.mkdirSync(dbPath, { recursive: true });
    return MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: "wiredTiger" },
      instanceOpts: [{ dbPath }],
    });
  })());
