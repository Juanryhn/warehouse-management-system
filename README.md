# Warehouse Management System

A single-warehouse WMS built with Next.js 16 (App Router, Cache Components), MongoDB and server-verified sessions. It answers three questions for every item: **what do we have, where is it, and who changed it, when, and why.**

See [`docs/product-plan.md`](docs/product-plan.md) for the full requirements and delivery plan.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). No `.env` file is needed for local development: with no `MONGODB_URI`, the app starts a single-node `mongodb-memory-server` replica set so transactions work exactly as they do on Atlas. Data persists in the OS temp directory (`wms-data/mongo`) between restarts.

On first run the database is seeded with users, a warehouse, bins, categories, products, opening stock and movement history. Set `WMS_SEED=false` to skip seeding against an existing database.

### Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | _(none)_ | MongoDB connection string. **Required in production**; must point to a replica set. |
| `MONGODB_DB` | `wms` | Database name. |
| `SESSION_DAYS` | `7` | Session cookie lifetime in days. |
| `ADJUSTMENT_APPROVAL_THRESHOLD` | `10` | Absolute adjustment quantity above which manager approval is required. |
| `WMS_SEED` | `true` | Set to `false` to disable automatic demo seeding. |

### Seeded accounts

| Email | Password | Role |
| --- | --- | --- |
| `admin@wms.local` | `admin123` | admin |
| `manager@wms.local` | `manager123` | manager |
| `operator@wms.local` | `operator123` | operator |
| `viewer@wms.local` | `viewer123` | viewer |

Passwords are hashed server-side with PBKDF2-SHA256 (600k iterations) in the format `pbkdf2$<iterations>$<salt>$<hash>`. Existing hashes are transparently rehashed on the next successful login. Sessions are opaque tokens stored as SHA-256 hashes in MongoDB; only the token itself is sent to the browser in an `httpOnly`, `SameSite=Lax` cookie (secure in production). Signing out, deactivating a user, or resetting their password invalidates their sessions.

## What is implemented

- **Auth & RBAC** — server actions re-check the session and role on every mutation; `proxy.ts` only performs optimistic redirects. Capabilities: operate, cancel, approve, manage catalog, manage users, export.
- **Catalog & locations** — product CRUD with unique SKU/barcode, categories, units, filters and pagination, transactional CSV import with dry run; bins with type, status guards and printable labels.
- **Inventory** — per-bin stock with reserved/available quantities, append-only movement ledger, stock cards, low-stock view, adjustments with approval threshold, atomic bin transfers.
- **Inbound** — receipts with partial receiving, putaway bin assignment, posting and cancellation.
- **Outbound** — orders with bin-priority allocation, reservations, pick lists grouped by bin, pack, ship and cancellation with backorder visibility.
- **Cycle counts** — bin/zone snapshots, variance entry, manager approval/rejection that posts exactly one adjustment per non-zero variance, and a conflict guard blocking other stock changes in a counted bin.
- **Reports & settings** — stock, movement, receipt, order, count and audit reports with CSV export; user management, reference data and configuration overview.

All stock writes go through one transactional service in `lib/modules/inventory/service.ts`. Every change updates `stockLevels` with a guarded update, appends a movement with a unique key for idempotency, and writes an audit entry. `localStorage` is not used anywhere.

## Project layout

```
app/
  (auth)/login/                 # Server Action sign-in
  (app)/                        # shell, dashboard and operational screens
  api/exports/[report]/         # CSV Route Handler
lib/
  db/                           # client, indexes, seed, typed collections
  auth/                         # sessions, capabilities, login actions
  modules/                      # vertical slices: queries / service / actions
components/                     # ui, auth, layout primitives
docs/product-plan.md
```

`queries.ts` is server-only and read-only; `service.ts` owns transactions and invariants; `actions.ts` validates input with Zod, authorizes, calls the service, then revalidates tagged caches. UI never imports `service.ts` or the DB client.

## Scripts

```bash
npm run dev             # development server
npm run build           # production build
npm run start           # serve the production build
npm run lint            # ESLint
npm run typecheck       # TypeScript
npm test                # Vitest unit + integration tests
npm run test:unit       # boundary schema tests only
npm run test:integration # transactional stock service tests
npx playwright install chromium  # once, before first E2E run
npm run test:e2e        # Playwright auth/RBAC/route smoke tests
```

CI runs typecheck, lint, Vitest and the production build on Node 24, plus a separate Playwright job. The integration tests start their own in-memory replica set, so no database setup is needed.

## Production notes

- `MONGODB_URI` must be set and must point to a replica set (Atlas qualifies); standalone MongoDB cannot run the stock transactions.
- Set `WMS_SEED=false` and create users through **Settings → Users** instead of shipping demo accounts.
- Enable daily backups with point-in-time recovery. Time is stored in UTC and displayed in `Asia/Jakarta`.
- Inventory reads are deliberately uncached so a pick can never act on stale stock. Catalog and reference reads use `use cache` with `products`, `locations` and `reference` tags; mutations call `updateTag` for read-your-own-writes. `getCurrentUser()` uses `use cache: private`, so session data never enters a shared server cache.
