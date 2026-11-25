import "server-only";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const attempts = new Map<string, number[]>();

// Process-local throttling for the prototype; swap for Redis before horizontal scaling.
export const isRateLimited = (key: string): boolean => {
  const now = Date.now();
  const recent = (attempts.get(key) ?? []).filter((time) => now - time < WINDOW_MS);
  if (recent.length >= MAX_ATTEMPTS) {
    attempts.set(key, recent);
    return true;
  }
  recent.push(now);
  attempts.set(key, recent);
  return false;
};

export const clearRateLimit = (key: string): void => {
  attempts.delete(key);
};
