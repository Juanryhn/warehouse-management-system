# Warehouse Management System — Requirements & Delivery Plan

Status: draft for review · Date: 2026-11-25
Scope: operational core of a single-warehouse WMS, with a growth path to more.

## 1. Goal

Answer three questions reliably for every item: **what do we have, where is it, and who changed it, when, and why.**

Today the app has authentication and a placeholder dashboard. This plan defines the operational core — catalog, locations, inventory, inbound, outbound, counts — with auditable stock movements and role-based access.

Success at MVP: an operator receives a delivery, puts it away, and stock is accurate; a manager allocates and ships an order without overselling; a cycle count can reconcile a bin; and every quantity change is traceable to a user, a time, and a document.

## 2. Current state (verified)

| Area | Today |
| --- | --- |
| Framework | Next.js 16.4.6, App Router, Cache Components + Partial Prefetching, Turbopack |
| Styling | Tailwind v4, Geist, dark mode |
| Auth | Client-side PBKDF2, `localStorage`, 7-day session, cookie mirror for `proxy.ts` redirects |
| Data | None. No database, no domain model |
| UI | `/login`, protected `/` placeholder, shared `LogoMark` |
| Quality | TypeScript strict, ESLint; no tests, no CI |

**Key implication:** `localStorage` cannot support multi-user stock, atomic updates, or reporting. Moving to server data is a prerequisite for the core features, not a later optimization. If the project stays client-only, it remains a UI demo, not a WMS.

## 3. Assumptions

- One physical warehouse at launch; the schema supports more without redesign.
- Internal users only (admin, manager, operator, viewer). No customer portal.
- Quantities are integers in a base unit (pcs, kg). No batch/lot, expiry, or serial tracking in MVP.
- Target deployment: Vercel + MongoDB Atlas (a replica set is required for transactions).
- Sizing assumptions: ~5k SKUs, ~50k movements/month, <50 concurrent users.
- English UI copy for now; Indonesian is an open decision (§14).

## 4. Roles and permissions

| Capability | Admin | Manager | Operator | Viewer |
| --- | --- | --- | --- | --- |
| View stock, documents, reports | yes | yes | yes | yes |
| Receive, putaway, pick, pack, ship | yes | yes | yes | no |
| Create documents | yes | yes | yes | no |
| Cancel documents | yes | yes | no | no |
| Post stock adjustments | yes | yes (approve above threshold) | request only | no |
| Approve count variance | yes | yes | no | no |
| Manage products, categories, locations | yes | yes | no | no |
| Manage users and settings | yes | no | no | no |
| Export CSV | yes | yes | no | yes |

Authorization is enforced in the data access layer for every read and mutation. `proxy.ts` only performs optimistic redirects; it is not a security boundary.

## 5. Functional requirements

Priorities: **MUST** = MVP, **SHOULD** = next, **COULD** = later.

### E1 — Authentication and access (MUST)

- Server-verified sessions with opaque tokens in an `httpOnly` cookie; 7-day expiry; logout everywhere.
- User management: create user, assign role, deactivate, reset password (admin-set temporary password).
- Password hashing server-side (PBKDF2-SHA256 at 600k iterations, or argon2id; see §9).
- Login rate limiting and generic error messages (no account enumeration).
- Every Server Action and query re-checks the session and role.

Acceptance: a `viewer` calling a receive action gets `403` and no state change; an expired session redirects to `/login?next=…`; deactivating a user invalidates their sessions.

### E2 — Product catalog (MUST)

- Create, edit, archive products: unique SKU, optional unique barcode, name, category, base unit of measure, minimum stock, description.
- Categories (flat in MVP) and units of measure as reference data.
- Server-side search, filter by category/status, sort, pagination; filters reflected in the URL.
- Bulk CSV import with a dry-run validation report and per-row errors; CSV export.

Acceptance: duplicate SKU/barcode is rejected with a field-level error; archived products keep their history but cannot be received or ordered; a 1,000-row import either commits fully or reports every invalid row without partial writes.

### E3 — Locations (MUST)

- Warehouse → zone → bin hierarchy expressed by unique bin codes (e.g. `A-01-03`) plus a type: receiving, storage, picking, quarantine.
- Deactivate a bin only when its stock is zero.
- Bin label printing (print-friendly page in MVP; QR later).

Acceptance: a bin code is unique within a warehouse; receiving into an inactive or quarantine bin follows the documented rule; labels render at a fixed size for thermal printers.

### E4 — Inventory (MUST)

- Stock on hand per product per bin, plus reserved quantity and derived available (`onHand - reserved`).
- Immutable movement ledger: type (`receipt`, `putaway`, `pick`, `ship`, `transfer`, `adjustment`, `count`), product, bin(s), signed quantity, reference document, reason, actor, timestamp.
- Adjustments require a reason code; above a configurable threshold they need manager approval.
- Transfers between bins are atomic (out + in, one transaction).
- Low-stock view driven by the product minimum.
- Product stock card: movement timeline with document links.

Acceptance and invariants:

- `onHand >= 0` and `reserved <= onHand` always hold; a failed transaction leaves no partial change.
- Every quantity change writes exactly one movement; movements are never updated or deleted (corrections are new adjustment movements).
- Posting the same document twice cannot double-credit stock (idempotent posting).
- Sum of movements per product equals its current `onHand`.

### E5 — Inbound (MUST)

- Receipt draft: supplier, expected lines (product + quantity).
- Receive against lines (partial allowed), assign a bin per line, then post; posting credits stock and creates movements.
- Cancel a draft; completed receipts are immutable except for corrective adjustments.
- Printable receipt and putaway list.

Acceptance: receiving 3 of 5 expected units updates stock by 3 and keeps the receipt open; posting twice is a no-op; cancelling a posted receipt is not offered.

### E6 — Outbound (MUST)

- Order draft: customer and lines.
- Allocate available stock from bins (manual selection or bin-priority rule).
- Pick list grouped by bin; mark picked; pack; ship — shipping decrements stock and releases the reservation.
- Cancel releases reservations; insufficient stock produces a backorder quantity rather than negative stock.

Acceptance: allocation never exceeds available; shipping an unallocated line is rejected; cancellation returns stock to available exactly once.

Note: strict FIFO/FEFO is not in MVP. It requires lot or receipt-layer tracking, listed as a nice-to-have.

### E7 — Cycle counts (MUST)

- Create a count for a bin or zone, snapshot expected quantities, enter counted quantities.
- Variance is shown per line; manager approval posts adjustment movements; rejection leaves stock untouched.
- Count history with variance report.

Acceptance: expected quantities are frozen at count creation; approval produces exactly one adjustment per non-zero variance; a count in progress blocks conflicting adjustments in the same bin.

### E8 — Dashboard and reports (MUST)

- KPI cards: SKU count, low-stock count, open receipts, open orders, movements today.
- Reports: stock on hand (by product, by bin), movement history, receipt/order history, count variance.
- CSV export for each report; role-scoped visibility.

Acceptance: every KPI has a drill-down link to the filtered report; reports match ledger totals for the same period.

### E9 — Settings and audit (SHOULD)

- Reference data: suppliers, customers, reason codes, categories, units.
- Audit log for user management, approvals, cancellations, and settings changes (alongside stock movements).
- Export audit log for compliance.

## 6. Non-functional requirements

- **Integrity:** all stock writes go through one transactional service; optimistic concurrency guards on allocation; posting is idempotent via document status transition plus a unique movement key.
- **Security:** server-side authorization on every access path; input validation at boundaries; CSRF-safe mutations; `httpOnly` + `SameSite=Lax` + `Secure` cookies; no secrets or PII in logs; dependency audit in CI.
- **Performance:** p95 page render < 1.5s on office networks; mutation round-trip < 500ms excluding network; list queries indexed and capped; no unbounded queries.
- **Accessibility:** WCAG 2.1 AA basics — labels, focus rings, keyboard-only operation, contrast, touch targets for scanner devices.
- **Observability:** structured logs with request and user IDs; error tracking (Sentry or equivalent); audit trail as the business-level log.
- **Backup/DR:** Atlas daily backups with point-in-time recovery; documented restore drill; RPO 24h / RTO 4h for MVP.
- **Time:** store UTC, display `Asia/Jakarta`.

## 7. Domain model (MongoDB)

| Collection | Key fields | Indexes |
| --- | --- | --- |
| `users` | email, name, role, passwordHash, isActive, timestamps | unique `email` |
| `sessions` | tokenHash, userId, expiresAt | TTL on `expiresAt`; `userId` |
| `warehouses` | code, name, address, isActive | unique `code` |
| `locations` | warehouseId, code, zone, type, isActive | unique `(warehouseId, code)`; `(warehouseId, zone)` |
| `categories` | name, isActive | unique `name` |
| `products` | sku, barcode, name, categoryId, uom, minStock, isActive, timestamps | unique `sku`; unique sparse `barcode`; `(categoryId, name)` |
| `stockLevels` | productId, locationId, warehouseId, onHand, reserved, version, updatedAt | unique `(productId, locationId)`; `(warehouseId, locationId)` |
| `stockMovements` | type, productId, locationId, fromLocationId, toLocationId, quantity, referenceType, referenceId, lineId, reasonCode, actorId, createdAt | `(productId, createdAt)`; `(referenceType, referenceId)`; `(createdAt)` |
| `receipts` | number, supplier, status, lines[], createdBy, timestamps | unique `number`; `(status, createdAt)` |
| `orders` | number, customer, status, lines[], createdBy, timestamps | unique `number`; `(status, createdAt)` |
| `counts` | number, scope, status, lines[], countedBy, approvedBy, timestamps | unique `number`; `(status, createdAt)` |
| `auditLogs` | actorId, action, entityType, entityId, before, after, createdAt | `(entityType, entityId)`; `(createdAt)` |

Invariants (enforced in code and verified by integration tests):

1. `stockLevels.onHand >= 0`.
2. `0 <= reserved <= onHand`.
3. Each `stockLevels` change is produced by exactly one movement pair (or one movement for receipts/ships/adjustments).
4. Movement rows are append-only.
5. A posted document is immutable; corrections are new documents or adjustments.
6. `available = onHand - reserved` is never negative when allocating.

## 8. Architecture

### Decisions

| Decision | Recommendation | Why / alternative |
| --- | --- | --- |
| Data store | MongoDB Atlas with transactions | Planned direction; transactions are required for stock integrity. Atlas is a replica set by default. |
| Auth | Server sessions + `httpOnly` cookie, PBKDF2/argon2 | Replaces the localStorage prototype; revocation and real authorization. |
| Mutations | Server Actions + Zod, Route Handlers only for exports/webhooks | Built-in origin checks, no hand-rolled API for forms. |
| Reads | Server Components + Data Access Layer | Keeps secrets server-side; single authorization point. |
| Caching | Catalog `use cache` + tags; stock uncached until measured | Never cache a quantity that determines whether a pick can be allocated. |
| Code layout | Vertical slices per domain | Easier onboarding than layer-first folders. |
| UI primitives | shadcn/ui (Radix) for dialogs, menus, toasts; native tables first | Accessibility for free; defer TanStack Table until column features demand it. |
| Validation | Zod at every boundary | Shared schemas between actions and forms; typed errors. |

### Structure

```
app/
  (auth)/login/page.tsx
  (app)/
    layout.tsx            # shell; session read inside Suspense
    page.tsx              # dashboard
    products/ locations/ inventory/
    inbound/ outbound/ counts/ reports/ settings/
  api/exports/[report]/route.ts
lib/
  db/{client,collections,indexes}.ts
  auth/{session,authorize,actions}.ts
  modules/
    catalog/{schema,queries,service,actions}.ts
    locations/ inventory/ inbound/ outbound/ counts/
  validation/
components/{ui,auth,layout,data-table,scanner}/
scripts/{seed,create-admin}.ts
```

Rule: `queries.ts` is server-only and read-only; `service.ts` owns transactions and invariants; `actions.ts` validates input, authorizes, calls the service, then revalidates. UI never imports `service.ts` or the DB client.

### Stock write path

Every quantity change follows one path inside a Mongo transaction:

1. Load the document and validate the state transition (draft → posted, allocated → shipped).
2. Validate quantities and invariants against current `stockLevels`.
3. Insert the movement(s) with a unique key `(referenceType, referenceId, lineId, type)`.
4. Update `stockLevels` with a guarded update (`$inc` only when the result stays non-negative).
5. Update the document status and append the audit entry.

If any step fails, nothing is written. The unique movement key makes retries safe.

### Caching and instant navigation

- `getCurrentUser()` uses `use cache: private` and renders behind `<Suspense>` in the `(app)` layout, so the static shell paints immediately.
- Catalog reads are cached with `cacheTag('products')` / `cacheTag('locations')`; mutations call `updateTag(...)`.
- Inventory reads are uncached initially. Add short-lived tagged caches only after measuring.
- Once the server-side session gate replaces the current client-only guard, remove `export const instant = false` from `app/(protected)/page.tsx` so instant-navigation validation runs again.
- List filters live in `searchParams` inside a Suspense boundary, keeping the shell static.

### UI/UX requirements

- App shell with sidebar (Dashboard, Inventory, Inbound, Outbound, Counts, Reports, Settings) and a user/role menu.
- Dense but legible tables: 25/50/100 rows, sticky header, URL-driven filters, empty and error states, bulk selection.
- Task forms optimised for repetition: scan field autofocus, Enter to advance, explicit confirmation for destructive actions.
- Status badges and toasts for every mutation outcome.
- Keyboard-first operation; scanner devices act as keyboards and need no special hardware integration.

## 9. Migration from the local prototype

1. Add `lib/db` and the collections/index bootstrap; require `MONGODB_URI` at startup.
2. Implement `MongoUserRepository` and `MongoSessionRepository`; move login into a Server Action that sets an `httpOnly` cookie.
3. Create `getCurrentUser()` with `use cache: private`; wrap the `(app)` layout session read in `<Suspense>`; delete the client `AuthProvider` guard.
4. Import existing PBKDF2 hashes (Node verifies the same `pbkdf2$…` format) and raise iterations to 600k on the next successful login; optionally switch to argon2id later.
5. Replace `getAuth()` in `lib/auth/index.ts`; the login form keeps the same `useActionState` shape.
6. Delete `local-repositories.ts`, demo seeding, and the `wms_session` cookie mirror; keep one seeded admin created by a script.
7. Create the remaining users through the admin UI; no self-signup.

Stop condition: `localStorage` is no longer referenced by application code.

## 10. Delivery plan

Estimates assume one experienced full-stack developer with review support; they exclude design exploration and vendor setup.

| Milestone | Scope | Size | Exit criteria |
| --- | --- | --- | --- |
| M0 Foundation | Mongo client, env validation, server auth + RBAC, app shell, error/loading conventions, shadcn setup, seed script, Vitest + Playwright baseline | M (3–5 d) | Login works against Mongo; forbidden actions return 403; CI runs lint, types, tests, build |
| M1 Catalog | Products, categories, UoM, locations; search/filter/pagination; CSV import/export | M (4–6 d) | 1k-row import dry-run + commit; duplicate SKU/barcode rejected; bin uniqueness enforced |
| M2 Inventory core | Stock levels, movement ledger, adjustments with approval, bin transfers, low stock, stock card | L (6–8 d) | Invariant and idempotency tests pass; reconciliation query matches ledger; no negative stock under concurrent allocation |
| M3 Inbound | Receipts, partial receiving, putaway, posting, printable documents | M (4–6 d) | Receive → putaway produces correct movements; double post is a no-op |
| M4 Outbound | Orders, allocation, pick list, pack, ship, cancel, backorder | L (6–8 d) | Allocation never exceeds available; ship/cancel adjust stock exactly once; backorder visible |
| M5 Counts & reports | Cycle count + variance approval; stock/movement/receipt/order reports; CSV export; KPIs | M (4–6 d) | Approval reconciles bin; every KPI drills into a report; exports match ledger |
| M6 Hardening | Audit UI, alerts, performance pass, accessibility audit, docs, backup/restore drill | M (3–5 d) | p95 budgets met on seeded data; a11y checks pass; restore drilled |

Total: roughly 30–44 developer-days (6–9 weeks) for the MVP defined above.

### Definition of done (every feature)

- Server-side authorization and Zod validation on the boundary.
- Invariant tests and at least one E2E path for the critical flow.
- Loading, empty, error, and success states handled.
- Audit/movement records produced where state changes.
- No direct writes to `stockLevels` outside the inventory service.
- `tsc`, lint, unit tests, and build green.

## 11. Testing and quality gates

- **Unit (Vitest):** quantity math, allocation rules, state machines, Zod schemas, formatting.
- **Integration (Vitest + Mongo):** transactions, invariant guards, idempotent posting, reconciliation; use `mongodb-memory-server` with a replica set or a dedicated test database.
- **E2E (Playwright):** login/RBAC, receive → putaway → stock, allocate → ship → stock, count approval, CSV import.
- **CI:** lint, typecheck, unit, build on every PR; integration and E2E on PRs touching `lib/modules/**` or `lib/db/**`.
- **Seeding:** deterministic seed for demos and E2E; never run demo seeds in production.

## 12. Nice-to-have backlog (improvisation)

Ordered by operational value relative to effort.

| Feature | Value | Effort | Build when |
| --- | --- | --- | --- |
| Barcode labels + global scan box (keyboard-wedge; camera via `BarcodeDetector` with fallback) | Very high | S–M | M1–M2; it cuts the most keystrokes per task |
| Print pack: pick list, receipt, putaway list, bin labels (print CSS, thermal-friendly) | High | S | M3–M4 |
| Low-stock reorder suggestions → draft purchase order | High | S | After M2, once thresholds are trusted |
| CSV import wizard with dry-run and downloadable error file | High | S | Already in M1; extend with reusable mapping |
| Movement/stock-card timeline with reference links | High | S | M2; primary debugging tool for stock disputes |
| Audit log viewer with filters and export | Medium | S | M6 |
| Alerts (email/Telegram/Slack) for low stock, overdue orders, variance | Medium | S | After M6; needs an outbound channel decision |
| Cycle count scheduler using ABC classification | Medium | M | When counts become routine |
| Attachments for damage/claims (R2/S3 + signed URLs) | Medium | S–M | When returns/damage handling starts |
| Returns (RMA) flow with quarantine disposition | High if returns exist | M | Early if the business receives returns; schema supports it |
| Unit conversions (carton ↔ pcs ↔ pallet) | Medium | M | When receiving units differ from picking units |
| Multi-warehouse UI + inter-warehouse transfers | Medium | M–L | Schema supports it now; UI only when a second site exists |
| Batch/lot + expiry with FEFO | High for food/pharma | L | Only if the domain requires it; retrofitting is costly, so decide before storing lots |
| Serial number tracking | Medium | L | Electronics/high-value goods only |
| Stock valuation (FIFO / weighted average) | Medium | L | When finance needs inventory value; needs cost layers |
| Dashboard analytics: turnover, dead stock, ABC, fill rate | Medium | M | After 2–3 months of real movement data |
| Offline-first PWA queue for weak Wi-Fi | High on the floor | L | If the warehouse has unreliable connectivity; needs conflict rules |
| Kiosk mode for shared rugged devices (large targets, auto-lock) | Medium | S | When tablets are deployed |
| API tokens + webhooks for ERP/marketplace sync | High if integrating | M | When an external system is confirmed; design idempotency first |
| Role-based dashboards and an approval inbox | Medium | S | Once managers have >10 pending approvals/day |
| Command palette for power users | Low | S | After the navigation stabilises |
| Indonesian/English i18n | Medium | S–M | If operators are more comfortable in Bahasa |

Explicitly out of scope for now: customer portal, accounting ledger, demand forecasting, robotics/WES integration, custom report builder, multi-currency.

## 13. Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Stock drift from multiple write paths | Wrong picks, lost trust | Single transactional service; invariants; reconciliation report; append-only ledger |
| Mongo transactions unavailable (standalone `mongod`) | Posting fails | Atlas or a replica-set local dev setup documented in the README |
| Cache staleness under Cache Components | Users act on stale stock | Do not cache inventory reads; tag + `updateTag` for catalog; measure first |
| Scope creep into lot/serial/valuation | Delays MVP | Deferred list; decide lots before data exists |
| Concurrent allocation oversell | Negative stock | Guarded updates/transactions; integration test with parallel operations |
| CSV import data quality | Garbage in | Dry-run, per-row errors, idempotent import key |
| Client-side auth prototype resurfacing | False sense of security | M0 removes it; `proxy.ts` documented as non-authoritative |
| Mobile/scanner usability | Slow adoption | Keyboard-first design, large targets, print artifacts |
| Timezone/date bugs | Counts and reports off by a day | UTC storage, single formatting helper, `Asia/Jakarta` display |

## 14. Open decisions

1. **Lot/expiry or serial tracking** — needed at launch? It changes the schema and allocation logic (FEFO) and is expensive to retrofit.
2. **Multi-warehouse at launch** — the schema supports it; the UI in MVP assumes one.
3. **UI language** — English only, or Bahasa Indonesia from day one?
4. **Approval policy** — who approves adjustments and cancellation, and at what quantity/value threshold?
5. **Deployment** — Vercel + Atlas confirmed? Any on-premise or VPC requirement?
6. **Team capacity and deadline** — the estimates assume one senior developer; parallel work can compress M3/M4.
7. **Integrations** — any ERP, marketplace, or accounting system to sync with later?
8. **Connectivity** — is offline operation on the warehouse floor a real requirement?
