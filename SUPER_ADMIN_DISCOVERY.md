# Super Admin Discovery

**Investigation date:** 2026-09-18  
**Repository:** `D:\Work\ecommerce-admin-cwa`  
**Scope:** Evidence-based discovery only. No application code, API, schema, authentication, dependency, or TODO-file changes were made for this investigation.

## 1. Current Repository Overview

This repository is a single Next.js application that combines three responsibilities:

1. An authenticated per-store admin dashboard.
2. A CMS and PostgreSQL/Prisma system of record for catalog and order data.
3. A public-ish REST API consumed by a separate storefront application.

The current source is not only a frontend. Server Components and route handlers use Prisma directly. Client forms and tables call route handlers with Axios. The separate storefront repository is not present here, so its implementation, payload construction, and deployment cannot be verified from this repository.

The source currently contains a Cash-on-Delivery order route. Stripe is **not** currently implemented in the source: `stripe` is absent from `package.json`, there is no `lib/stripe.ts`, and there are no checkout or webhook route files. The git history includes commit `947cc38 removed stripe from the repo`. Some statements in `docs/PROJECT_BRIEF.md` still describe Stripe as present; source code and current dependency files are authoritative for this report.

There is no invoice, subscription, commission, platform-fee, PDF, or scheduled-job implementation. There is one Resend-based email path for new COD order notifications.

## 2. Technology Stack

From `package.json` and the source:

- Next.js `13.4.5` App Router, React `18.2.0`, TypeScript `5.1.3`.
- Tailwind CSS `3.3.2`, `next-themes`, shadcn/ui-style components built on Radix UI.
- Prisma `4.16.1` / `@prisma/client` with PostgreSQL in `prisma/schema.prisma`.
- Clerk `@clerk/nextjs` `^4.21.3` for authentication.
- Cloudinary through `next-cloudinary` for product images.
- React Hook Form + Zod for client form validation; route handlers use manual checks rather than shared schemas.
- Axios for client-to-route-handler mutations.
- Zustand for small client UI state; no React Query/SWR server cache.
- TanStack Table and Recharts for tables and the dashboard chart.
- Resend for server-side order notification email.
- `date-fns`, `react-hot-toast`, `lucide-react`, and utility packages.

`package.json` has scripts for `dev`, `build`, `start`, `lint`, and Prisma generation via `postinstall`. There is no seed script, test script, or separate typecheck script. `README.md` is historical tutorial documentation and still describes MySQL/PlanetScale; the schema is PostgreSQL.

## 3. Current Architecture

### Routing and rendering

- `app/(auth)/...` contains Clerk `<SignIn />` and `<SignUp />` pages.
- `app/(root)/...` is the no-store bootstrap path. Its layout calls Clerk `auth()`, redirects unauthenticated users to `/sign-in`, and opens the create-store modal when the user owns no store.
- `app/(dashboard)/[storeId]/...` is the authenticated store dashboard. Its layout checks both the Clerk user and `Store.id + userId` ownership before rendering the navbar and child route.
- `app/api/...` contains REST-style route handlers. Catalog paths are generally `/api/[storeId]/<resource>` and `/api/[storeId]/<resource>/<id>`.

Most dashboard list and detail pages are async Server Components querying Prisma directly. Interactive forms, tables, modals, and dropdowns are Client Components. Mutations use Axios/fetch to route handlers; no Next.js Server Actions (`"use server"`) were found. The `actions/` directory contains ordinary async Prisma helper functions, not Server Actions.

### Application services and storage

- `lib/prismadb.ts` exports the development-safe Prisma singleton used by pages and handlers.
- `prisma/schema.prisma` is the authoritative data model; two migrations are checked in.
- Product images are URL records pointing at Cloudinary; there is no binary/image storage in PostgreSQL.
- `next.config.js` allows `res.cloudinary.com` images.
- No separate backend service, API gateway, queue, worker, cron, or shared package is present in this repository.

### API surface actually present

- Store creation: `POST /api/stores`.
- Store update/delete: `PATCH` and `DELETE /api/stores/[storeId]`.
- Public store branding read: `GET /api/stores/[storeId]`.
- Store-scoped catalog CRUD/read routes for billboards, categories, sizes, colors, and products.
- COD order creation: `POST /api/[storeId]/cod` plus permissive `OPTIONS` CORS handling.
- Order status mutation: `PATCH /api/[storeId]/orders/[orderId]`.

There is no order list/detail API route; the admin orders page queries Prisma directly. There is no aggregate or cross-store reporting API.

## 4. Authentication / Clerk

### Configuration and sign-in flow

- `app/layout.tsx` wraps the application in `<ClerkProvider>`.
- `app/(auth)/(routes)/sign-in/[[...sign-in]]/page.tsx` renders Clerk `<SignIn />`.
- `app/(auth)/(routes)/sign-up/[[...sign-up]]/page.tsx` renders Clerk `<SignUp />`.
- `components/navbar.tsx` renders Clerk `<UserButton afterSignOutUrl="/" />`.
- `middleware.ts` uses Clerk `authMiddleware` and marks `/api/:path*` as public at middleware level. Non-API pages are therefore gated by middleware and/or their layouts.

### Identity and application mapping

The application does not have a local `User` model. The Clerk `userId` string is stored directly on `Store.userId`. `auth()` is called in the root layout, dashboard layout, navbar, and most write handlers. A store is created with the currently authenticated `userId` in `app/api/stores/route.ts`.

`Navbar` queries all stores with `where: { userId }`; the store switcher therefore supports one Clerk user owning multiple stores. No evidence was found that a store can have multiple users, that membership is modeled, or that Clerk Organizations are used.

### Metadata, roles, permissions, and webhooks

No usage of Clerk Organizations, user metadata, public/private/unsafe metadata, roles, permissions, Clerk webhooks, or custom claims was found. Authorization is based on the current Clerk user ID and ad hoc store ownership checks, not a role system. There is no platform-admin identity in the current repository.

### Implication for a future Super Admin

The evidence supports investigating reuse of the same Clerk instance/application and existing users, but there is no existing platform-role mechanism to reuse. A future platform role must be established and validated server-side (for example, an explicitly managed Clerk role/metadata claim or a platform-admin database mapping). The browser must not be trusted to declare itself a Super Admin. The exact Clerk tenancy/configuration and operational account ownership are not discoverable from source alone.

## 5. Authorization / Roles

The normal write pattern is:

1. Call Clerk `auth()` and require `userId`.
2. Query `Store` with both the requested store ID and that `userId`.
3. Perform the mutation.

This pattern appears in store, billboard, category, size, color, and product write routes and in the dashboard layout. There is no centralized authorization helper, middleware, policy layer, database row-level security, or explicit role check.

Read routes under `/api/[storeId]` are intentionally reachable through the public middleware exception for storefront use. They return store-scoped catalog data, but most do not authenticate or independently validate that the requested child record belongs to the path store.

The following important exceptions were verified in source:

- `app/api/[storeId]/orders/[orderId]/route.ts` has no `auth()` call, no `storeId` ownership check, and updates an order by `orderId` alone.
- Most child-resource mutations verify that the caller owns `params.storeId`, then update/delete by child ID alone. They do not include `storeId` in the child mutation predicate, so a caller who knows another store's child ID may have an IDOR/cross-store mutation path.
- `POST /api/[storeId]/cod` does not authenticate (intended public checkout), but it also queries products by supplied IDs without constraining them to `params.storeId`.
- Product/category/size/color foreign IDs supplied to create/update routes are not verified as belonging to the same store.

## 6. Store / Tenant Model

### Store entity

`Store` in `prisma/schema.prisma` has:

- `id` UUID primary key.
- `name`, optional `logoUrl`.
- `userId` string containing the Clerk user ID.
- `createdAt` and `updatedAt`.
- Relations to billboards, categories, colors, orders, products, and sizes.

There is no billing address, contact email, currency, subscription, fee, invoice, or store-member table.

### Store-scoped entities

`Billboard`, `Category`, `Product`, `Size`, `Color`, and `Order` each carry a `storeId` foreign key and an index on it. `OrderItem` carries `orderId` and `productId` but no `storeId`; `Image` carries `productId`. PostgreSQL foreign keys preserve relation integrity, but the schema does not enforce that a product's category, size, or color belongs to the same store, nor that an order item's product belongs to the order's store.

### Where scoping is applied

- Dashboard layout: `Store.id + userId` check before rendering any store route.
- Dashboard Server Components: commonly filter direct Prisma queries by `params.storeId`.
- Authenticated writes: generally check `Store.id + userId`, then mutate by resource ID.
- Public catalog GETs: filter collection queries by `storeId`; child GETs generally query by child ID only.
- COD: accepts a path store ID and writes the order to it, but product lookup is only by supplied product IDs.

There are no existing cross-store queries or platform-level endpoints. Cross-store aggregation is technically possible for server-side code with Prisma, but it is not implemented or exposed. Introducing a Super Admin should add a separately authorized platform capability rather than weakening the existing store-user path.

## 7. Sales / Orders Data Model

### Order fields and statuses

`Order` contains:

- `id`, `storeId`, `createdAt`, `updatedAt`.
- `status`: `DRAFT`, `CONFIRMED`, `DELIVERED`, or `CANCELED`.
- `paymentMethod`: `STRIPE` or `COD` (the enum remains even though Stripe code is absent).
- Unique `trackingId`.
- Boolean `isPaid`, default `false`.
- Customer name, email, phone.
- Structured shipping fields (`addressLine1`, `addressLine2`, `city`, `postalCode`, `country`, `customerNotes`) plus a legacy `address` string.

`OrderItem` links an order to a product. It has no quantity, unit-price snapshot, line total, tax, discount, currency, refund, or payment-provider transaction ID. Product price is a mutable `Decimal`; order totals are not persisted.

### Current order creation path

`app/api/[storeId]/cod/route.ts`:

1. Accepts `productIds[]`, customer data, shipping data, and optional COD marker.
2. Reads current product prices and attributes from Prisma.
3. Sums one current `Product.price` for each supplied ID.
4. Creates a `DRAFT` COD order with `isPaid: false`, a server-generated `ORD-YYMMDD-XXXXXX` tracking ID, and one OrderItem per supplied ID.
5. Sends a best-effort new-order email to the store owner's Clerk email.
6. Returns order/tracking/status/customer/product/total data to the caller.

The route does not mark COD orders paid. No Stripe checkout or webhook path exists in current source, so no current code marks any order paid through Stripe. The order-status PATCH changes status and inventory archival only; it does not change `isPaid`.

### What currently counts as sales/revenue

The dashboard helpers define a paid sale as an order with `isPaid: true`:

- `actions/get-sales-count.ts` counts paid orders.
- `actions/get-total-revenue.ts` sums the current price of each product attached to paid orders.
- `actions/get-graph-revenue.ts` groups the same current-price sum by `Order.createdAt.getMonth()` and returns a Jan–Dec chart.

These calculations are per store and do not exclude a particular order status. Because totals are recomputed from mutable product prices and OrderItem has no quantity/price snapshot, historical revenue can change when a product price changes. The month graph is month-of-year only, not a year-aware monthly time series.

### Metric availability

| Metric | Assessment from current data |
|---|---|
| Total sales across all stores | Derivable with a new server-side aggregate/query over `Order`/`OrderItem` joined to `Product`; no current API/helper. |
| Sales per store | Derivable with a new grouped aggregate; `storeId` exists. |
| Sales by month | Derivable, but current helper is a per-store month-of-year chart and is not year-aware. A durable report needs date boundaries/time-zone rules. |
| Paid transaction/order count | Directly represented by `Order.isPaid`; current helper exposes paid order count per store. Cross-store endpoint is absent. |
| Average order value | Derivable from the same reconstructed paid-order totals and count, subject to mutable-price/no-quantity limitations. |
| Gross revenue | Derivable from current product prices for paid orders; no persisted authoritative order total. |
| Refunds | Impossible from current schema/code: no refund records, refunded amount, or refund status. |
| Taxes | Impossible: no tax fields/rates/lines. |
| Discounts | Impossible: no discount/coupon fields. |
| Net sales | Not authoritative; requires refund/tax/discount definitions and data. |
| Currency-normalized cross-store total | Not currently possible safely: no order/store currency field and formatter is PKR while the old brief/removed payment path referenced other assumptions. |
| Fulfillment status breakdown | Derivable from `Order.status`, but not equivalent to paid sales. |

## 8. Current Reporting Capabilities

The store dashboard at `app/(dashboard)/[storeId]/(routes)/page.tsx` displays:

- Total Revenue from `getTotalRevenue`.
- Sales count from `getSalesCount`.
- Non-archived product count from `getStockCount` (this is catalog inventory count, not units sold or stock quantity).
- A Jan–Dec revenue chart from `getGraphRevenue`.

The orders page reads all orders for one store directly with Prisma, formats product names and a reconstructed total, and allows a user to view details or request status changes. There is no pagination, date filtering, export, cross-store dashboard, or reporting API.

For a Super Admin, aggregate reporting should be implemented server-side (preferably an authorized platform API or backend service with database aggregation), not by downloading each store's orders into a browser. The existing helpers are useful as business-rule clues but are not sufficient as an accounting ledger.

## 9. Invoice / Billing Capabilities

No invoice or billing infrastructure was found. Specifically absent are:

- Invoice, invoice-line, subscription, platform-fee, commission, or billing-account models.
- Invoice numbering, billing addresses, legal entity/company information, VAT/tax data, due dates, statuses, payment links, or payment records.
- PDF generation, invoice templates, object storage for generated documents, or invoice audit history.
- Recurring/monthly job scheduling or idempotent invoice generation.
- Billing APIs or a payment provider integration for collecting invoice payments.

`components/user-nav.tsx` contains a static “Billing” menu item, but it has no route or behavior and is not an implemented billing feature. Monthly invoices therefore require a new domain model and backend workflow. Before implementation, the business definition of the monthly charge (fixed fee, commission, usage, currency, tax, period boundaries, and whether sales are gross or net) must be supplied.

## 10. Email Capabilities

The existing email path is:

- `lib/resend.ts` creates a Resend client from `RESEND_API_KEY`, returning `null` when absent.
- `lib/email/send-new-order-notification.ts` builds inline HTML and plain text for a new order.
- Recipient resolution uses `RESEND_TEST_RECIPIENT` when configured; otherwise it calls `clerkClient.users.getUser(store.userId)` and selects the primary/first email.
- Sender is `RESEND_FROM_EMAIL`.
- The COD route invokes the notification after creating the order and deliberately catches/logs notification failure so order creation succeeds.

There are no reusable invoice templates, attachment handling, PDF generation, outbound-message log/status, retries, queue, or delivery webhook. `@react-email/render` is installed but no source usage was found. Resend could reasonably support invoice email delivery after adding a template, generated/stored PDF, recipient policy, idempotency, and delivery tracking; the current helper should not be treated as a complete billing-mail service.

## 11. Backend / API Architecture

This repository is full-stack and owns the Prisma-backed API surface used by the separate storefront. It is not a thin frontend. However, there is no separate backend repository or platform service in this workspace. The only external services evidenced by source are Clerk, PostgreSQL, Cloudinary, and Resend.

The storefront contract is inferred from public catalog routes and COD creation, but the storefront repository is not available. Its actual request handling, cart quantity behavior, retry behavior, and customer-facing status semantics are unknown. No shared API types package exists; client/server validation schemas are duplicated and route handlers use manual field checks.

There are no server actions, background workers, cron handlers, webhook handlers, or event bus. Any future monthly invoice automation will need a deliberate execution mechanism (for example a protected scheduler endpoint plus an external scheduler, or a worker/platform service) and idempotency.

## 12. Existing TODO Context

### TODO file search result

No TODO markdown file was found in the repository. The non-dependency markdown files are `AGENTS.md`, `CLAUDE.md`, `README.md`, and `docs/PROJECT_BRIEF.md`; no tracked filename contains `TODO`, `task`, or `plan`. A repository-wide search outside `node_modules` found no TODO/to-do backlog document. I therefore cannot truthfully summarize a TODO file's completed or pending items, and it was not modified.

### Available historical/project context

`docs/PROJECT_BRIEF.md` is the closest durable architecture document. It records the intended Admin/CMS/API identity, PostgreSQL migration, COD additions, store scoping, known risks, and a recommended re-learning order. It also contains claims that are stale relative to current source, notably the existence of Stripe checkout/webhook code and Stripe dependency. `CLAUDE.md` repeats the current architectural rules and known risks. `README.md` is the original tutorial README and is stale on database/payment details.

### Current known pending/risk items evidenced by source

- No platform role or Super Admin capability.
- No cross-store reporting endpoint.
- No invoices/billing/PDF/scheduler.
- No Stripe implementation despite the enum and historical documentation.
- Unauthenticated order status mutation.
- Child-resource mutations that do not constrain the child ID to the verified store.
- COD product IDs not constrained to the requested store.
- No persisted order totals, quantities, currency, taxes, discounts, or refunds.
- Disabled billboard collection GET and incorrect billboard-by-ID GET behavior.

## 13. Reusable Components / Patterns

### A. Concepts/patterns worth copying

- Clerk provider, sign-in/sign-up pages, `auth()` usage, and redirect conventions.
- Prisma singleton pattern in `lib/prismadb.ts`.
- Store-scoped route naming and dashboard layout structure, after authorization hardening.
- React Hook Form/Zod form composition and manual API error/toast conventions as UI patterns only.
- shadcn/Radix primitives, Tailwind theme variables, dark-mode provider, table primitives, and Recharts integration.
- `formatter` and date-fns usage as starting points, after making currency and timezone explicit.
- Resend client configuration conventions and HTML escaping helper.

### B. Code that could realistically move to a shared package

Only after contract stabilization and ownership decisions:

- Shared primitive UI components and design tokens.
- A versioned API client and shared DTO/types for stable public/platform contracts.
- Validation schemas for request/response contracts (currently not shared).
- Currency/date/number formatting utilities with explicit locale/currency parameters.
- Error/result conventions and pagination types.

Do not share a Prisma client across deployed applications merely by copying generated client code; database access should remain behind an authorized backend boundary.

### C. Code that should remain store-admin-specific

- Catalog CRUD forms and store switcher.
- Store-owner navbar and per-store route layout.
- Product image upload workflow and Cloudinary widget wrapper.
- Store owner order-status controls and inventory-archival behavior.
- Store creation/settings UI.

## 14. Super Admin Requirements (as currently understood)

The requested third application should be a separate repository/application that can:

1. Reuse the existing Clerk authentication system.
2. Identify a platform-level Super Admin distinctly from store admins.
3. List all stores/tenants.
4. Display summarized sales across all stores.
5. Drill into store/order information permitted by the backend.
6. Generate monthly invoices for individual stores.
7. Track invoice lifecycle and payment state.
8. Send invoices to the appropriate store/customer recipients.
9. Leave room for later platform-level administration.

The current repository supplies store/catalog/order primitives and a Clerk user ID on each store, but it does not supply the platform-level authorization, accounting data, invoice domain, or reporting API needed to satisfy these requirements safely.

## 15. Likely Super Admin Integration Architecture

### Authentication

Investigate using the same Clerk instance/application so existing users can sign in to both applications. The new app would need its own ClerkProvider and route middleware configured for its domain. This is a likely reuse direction, not a confirmed deployment decision; the current repository has no multi-application Clerk configuration to inspect.

### Authorization

Store ownership (`Store.userId`) is not a platform role. Add a separate, server-validated platform-admin authorization source before exposing any cross-store capability. Candidate mechanisms include a tightly controlled Clerk role/claim or an explicit platform-admin mapping in a backend database. Do not infer authorization from a route, client state, store ID, or unvalidated metadata. Enforce the platform role in every platform API handler and log sensitive actions.

### APIs

The Super Admin should not use public catalog GETs or store-owner mutation routes for platform work. Existing store branding/catalog reads may be reused only for explicitly permitted drill-down display. New backend/platform endpoints will likely be required for:

- Authorized store list with owner/contact/billing fields.
- Cross-store sales aggregates with date, status, payment, and currency semantics.
- Store-level order/report drill-down with pagination and privacy controls.
- Invoice creation, preview, finalization, resend, and status transitions.
- Invoice document retrieval and email delivery status.

These should live behind a trusted backend boundary, ideally alongside the system of record or in a dedicated platform service, rather than having a browser connect directly to PostgreSQL.

### Data and reporting

Use database-side grouped aggregates or a reporting/read model. Do not fetch every store's orders into the Super Admin browser. First define the authoritative sale event, period/timezone, currency, treatment of DRAFT/CANCELED/COD orders, and whether product price changes must be prevented from changing history. The current schema may need order line snapshots, quantities, currency, payment/refund records, and immutable totals before financial reporting is reliable.

### Store isolation

Normal store-admin requests should remain constrained to `Store.id + authenticated user` and child queries should include the store predicate. Platform requests should use a separate explicit authorization branch that grants only the requested platform operations. A Super Admin UI must not be implemented by bypassing ownership checks globally or by making all existing routes cross-store aware.

### Billing and invoices

Invoice creation belongs in a trusted backend/platform layer with a durable invoice model, immutable finalized lines, numbering, period, currency, tax/fee rules, due date, status, and audit metadata. The Super Admin repository should orchestrate and display this capability; it should not be the sole source of financial truth.

### Email

Invoice email generation/sending should be server-side, preferably in the same platform billing service or a dedicated worker. Reuse Resend configuration only after adding a real invoice template/PDF pipeline, recipient and consent rules, delivery status, retry/idempotency, and secure document links.

### Repository boundaries

| Area | Existing ecommerce/admin repo | Future Super Admin repo | Shared/backend platform layer |
|---|---|---|---|
| Store-owner catalog and settings | Owns UI and current store-scoped routes | Read-only links/drill-down only | Optional stable read API |
| Store-owner order operations | Owns current UI/flow, after security fixes | Read-only platform views | Authorized aggregate/order APIs |
| Platform identity | No current role system | Login and platform UI | Server-side platform authorization source |
| Cross-store reporting | No current endpoint | Dashboard and filters | Aggregation/query/reporting service |
| Invoices/billing | No current implementation | Invoice UX and actions | Invoice model, calculations, documents, statuses |
| Email delivery | New-order Resend helper | Trigger/status UI | Invoice template, sending, retries, audit |

## 16. Backend Changes Likely Required Before Implementation

These are discovery conclusions, not changes made in this pass:

1. Define and enforce a platform-admin role/authorization mechanism.
2. Add a protected platform API or service for store lists, aggregates, drill-down, and billing operations.
3. Harden all child-resource mutation predicates with store ownership and validate related IDs belong to the same store.
4. Add store scoping to COD product lookup and order-item integrity checks.
5. Protect order status mutation with authentication, store ownership, status validation, and an explicit policy for platform operators.
6. Establish an authoritative order-total/accounting model: quantity, immutable unit price/line totals, currency, tax/discount/refund semantics, and payment transaction references as needed.
7. Decide how COD payment completion is recorded and how canceled/refunded orders affect reports.
8. Add invoice, invoice-line, billing recipient, delivery attempt, and payment/status data plus migrations.
9. Add idempotent monthly invoice generation and a scheduler/worker integration.
10. Add PDF/document storage and secure retrieval if invoices must be attached or downloaded.
11. Add versioned API contracts/shared types and server-side validation where the two applications must interoperate.

## 17. Security Considerations

The following findings are supported by current source:

- **Unauthenticated order mutation:** `PATCH /api/[storeId]/orders/[orderId]` can change any known order status and trigger product archival/restoration without Clerk authentication or ownership validation.
- **Order/store IDOR:** that handler ignores the path `storeId` when fetching/updating the order.
- **Child-resource IDOR risk:** authenticated routes verify ownership of the path store but then mutate by child ID alone. Resource predicates should include both child ID and store ID (or first verify the child relation).
- **Cross-store product mixing in COD:** product lookup uses only supplied IDs, not `storeId`, while the new order is written to the path store.
- **Cross-store relation risk:** product/category/color/size IDs from request bodies are not checked against the same store; the schema also does not enforce this composite invariant.
- **Public child reads:** public child GETs often query only by resource ID. Catalog data may be intentionally public, but store-boundary behavior and enumeration should be reviewed.
- **Wide-open CORS:** COD explicitly returns `Access-Control-Allow-Origin: *`; there is no origin allowlist.
- **No role enforcement:** no platform/admin role or permission checks exist, and no Clerk metadata is read.
- **Manual duplicated authorization:** every new route must remember to implement the ownership predicate; there is no central guard.
- **Financial data integrity:** order totals are reconstructed from mutable product prices, no quantities or price snapshots exist, and no refund/tax/discount/currency records exist.
- **Sensitive customer data:** orders contain contact and shipping information; a platform API will need least-privilege fields, pagination, audit logging, and privacy/retention decisions.
- **Operational leakage:** `app/api/stores/[storeId]/route.ts` logs `RequestHit`; errors and notification failures are logged without a structured audit system.

No actual secret values were found. `.env`/`.env.local` are ignored and no environment file is checked in.

## 18. Unknowns / Things Requiring Another Repo or Backend

- The separate storefront's code, payloads, cart quantity behavior, retry behavior, and deployment are unavailable.
- The production Clerk instance, domains, dashboard configuration, MFA policy, and account-admin process are unavailable.
- The production database contents, data quality, current order volume, and whether old Stripe-era rows exist are unknown.
- It is unknown whether any external service or deployment platform runs jobs outside this repository.
- Business billing rules are unspecified: fixed fee versus commission, tax/VAT, currency, invoice recipient, period timezone, due dates, payment method, and refund treatment.
- Legal entity, invoice numbering, tax registration, retention, privacy, and audit requirements are unknown.
- Production Resend sender verification, domain, deliverability settings, and any external email logs are unknown.
- It is unknown whether another backend repository, database view, or operational script exists outside this workspace.

## 19. Recommended Investigation Before Implementation

1. Obtain and inspect the storefront repository and document the actual API payload/response contract.
2. Confirm the production Clerk application/instance and decide how platform admins will be provisioned and revoked.
3. Inventory production database rows, especially payment methods/statuses, historical Stripe-era orders, product-price changes, and stores without usable owner emails.
4. Define accounting semantics with the product/business owner before designing aggregates or invoices.
5. Decide whether platform reporting/billing belongs in this repository, a separate trusted backend, or a shared service; keep both UIs as clients of stable APIs.
6. Design authorization and audit logging before exposing any cross-store query.
7. Fix and test store-boundary/IDOR issues before allowing a platform app to rely on current routes.
8. Design invoice state transitions, idempotency, PDF storage, email retries, and scheduler ownership.
9. Establish API versioning and shared DTO/validation contracts between the existing admin, storefront, and future Super Admin.
10. Reconcile the source-vs-documentation discrepancy around removed Stripe functionality before interpreting historical data.

## 20. Important File Reference Index

- `package.json` — actual dependencies and scripts; confirms no current Stripe dependency.
- `middleware.ts` — Clerk middleware and public API route configuration.
- `app/layout.tsx` — root `ClerkProvider`, theme, toast, and modal providers.
- `app/(auth)/(routes)/sign-in/[[...sign-in]]/page.tsx` — Clerk sign-in page.
- `app/(auth)/(routes)/sign-up/[[...sign-up]]/page.tsx` — Clerk sign-up page.
- `app/(root)/layout.tsx` — unauthenticated redirect and no-store bootstrap gate.
- `app/(dashboard)/[storeId]/layout.tsx` — per-store Clerk ownership gate.
- `app/api/stores/route.ts` — store creation tied to the current Clerk `userId`.
- `app/api/stores/[storeId]/route.ts` — store update/delete ownership checks and public branding GET.
- `components/navbar.tsx` — current user's store list and Clerk `UserButton`.
- `components/store-switcher.tsx` — multi-store UI for one Clerk user.
- `prisma/schema.prisma` — authoritative Store, catalog, Order, OrderItem, and enum model.
- `prisma/migrations/20260228195737_add_order_customer_shipping_fields/migration.sql` — initial PostgreSQL order/customer/shipping schema and indexes.
- `prisma/migrations/20260301080140_add_store_logo/migration.sql` — store logo migration.
- `lib/prismadb.ts` — Prisma client singleton.
- `app/api/[storeId]/cod/route.ts` — current public COD order creation, totals, tracking IDs, and notification call.
- `app/api/[storeId]/orders/[orderId]/route.ts` — order status mutation and inventory side effects; critical auth risk.
- `app/(dashboard)/[storeId]/(routes)/orders/page.tsx` — direct Prisma store order query and reconstructed display totals.
- `actions/get-total-revenue.ts` — paid-order revenue calculation from current product prices.
- `actions/get-sales-count.ts` — paid-order count.
- `actions/get-graph-revenue.ts` — per-store month-of-year revenue chart.
- `actions/get-stock-count.ts` — non-archived product count.
- `lib/resend.ts` — Resend client factory.
- `lib/email/send-new-order-notification.ts` — current owner email notification and Clerk email lookup.
- `lib/trackingId.ts` — COD `ORD-YYMMDD-XXXXXX` generator.
- `lib/utils.ts` — PKR formatter and class-name utility.
- `app/api/[storeId]/billboards/route.ts` — billboard POST; collection GET is commented out.
- `app/api/[storeId]/billboards/[billboardId]/route.ts` — billboard child GET currently does not use `billboardId` correctly.
- `docs/PROJECT_BRIEF.md` — useful architecture context, but reconcile its stale Stripe claims with source.
- `CLAUDE.md` — repository-specific development rules and known risks.
- `README.md` — historical tutorial context; stale MySQL/PlanetScale instructions.

## Bottom Line

The requested third Super Admin application is feasible as a separate UI, and Clerk reuse is a plausible direction, but the current repository is not yet a platform-admin backend. It has store-scoped catalog/order primitives, a Clerk user-to-store ownership convention, and a small Resend email helper. It lacks a server-validated platform role, cross-store reporting API, reliable accounting fields, invoice/billing domain, PDF/document pipeline, scheduler, and invoice email tracking. Those capabilities should be designed as an explicitly authorized backend/platform layer, with the Super Admin repository consuming that layer rather than bypassing store isolation or querying the database directly from the browser.
