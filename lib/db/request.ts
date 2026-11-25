import "server-only";
import { connection } from "next/server";
import { getCollections } from "./ready";

// Uncached reads must defer until request time: the Mongo driver reads the
// clock internally, which Cache Components rejects during prerendering.
export const getRequestCollections = async () => {
  await connection();
  return getCollections();
};
