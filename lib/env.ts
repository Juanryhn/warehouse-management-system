import { z } from "zod";

const schema = z.object({
  MONGODB_URI: z.string().min(1).optional(),
  MONGODB_DB: z.string().min(1).default("wms"),
  SESSION_DAYS: z.coerce.number().int().positive().default(7),
  ADJUSTMENT_APPROVAL_THRESHOLD: z.coerce.number().int().nonnegative().default(10),
  WMS_SEED: z.enum(["true", "false"]).default("true"),
});

export const env = schema.parse(process.env);
