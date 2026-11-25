import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { ObjectId } from "mongodb";
import { requireUser } from "@/lib/auth/session";
import { getCollections } from "@/lib/db/ready";
import { getRequestCollections } from "@/lib/db/request";

type CachedLocation = {
  id: string;
  code: string;
  zone: string;
  type: "receiving" | "storage" | "picking" | "quarantine";
  isActive: boolean;
};

const listLocationsCached = async (): Promise<CachedLocation[]> => {
  "use cache";
  cacheLife("minutes");
  cacheTag("locations");
  const { locations } = await getCollections();
  const docs = await locations.find({}).sort({ code: 1 }).toArray();
  return docs.map((doc) => ({
    id: doc._id.toHexString(),
    code: doc.code,
    zone: doc.zone,
    type: doc.type,
    isActive: doc.isActive,
  }));
};

export const listLocations = async () => {
  await requireUser();
  const [base, { stockLevels }] = await Promise.all([listLocationsCached(), getRequestCollections()]);
  // Occupancy changes with every stock movement, so read it outside the cached catalog view.
  const levels = await stockLevels.find({ onHand: { $gt: 0 } }).toArray();
  const counts = new Map<string, number>();
  for (const level of levels) counts.set(level.locationId, (counts.get(level.locationId) ?? 0) + 1);
  return base.map((location) => ({ ...location, products: counts.get(location.id) ?? 0 }));
};

const getLocationOptionsCached = async () => {
  "use cache";
  cacheLife("minutes");
  cacheTag("locations");
  const { locations } = await getCollections();
  const docs = await locations.find({ isActive: true }).sort({ code: 1 }).toArray();
  return docs.map((doc) => ({ value: doc._id.toHexString(), label: doc.code }));
};

export const getLocationOptions = async () => {
  await requireUser();
  return getLocationOptionsCached();
};

const getZoneOptionsCached = async () => {
  "use cache";
  cacheLife("minutes");
  cacheTag("locations");
  const { locations } = await getCollections();
  const zones = await locations.distinct("zone");
  return zones.filter(Boolean).sort().map((zone) => ({ value: zone, label: zone }));
};

export const getZoneOptions = async () => {
  await requireUser();
  return getZoneOptionsCached();
};

const getLocationCached = async (id: string) => {
  "use cache";
  cacheLife("minutes");
  cacheTag("locations");
  if (!ObjectId.isValid(id)) return null;
  const { locations } = await getCollections();
  const doc = await locations.findOne({ _id: new ObjectId(id) });
  if (!doc) return null;
  return { id: doc._id.toHexString(), code: doc.code, zone: doc.zone, type: doc.type, isActive: doc.isActive };
};

export const getLocation = async (id: string) => {
  await requireUser();
  return getLocationCached(id);
};
