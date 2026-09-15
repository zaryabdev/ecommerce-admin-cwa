# Project Identity

This repository is the **Admin / CMS / API backend** for a multi-tenant e-commerce platform. It was originally built by following Antonio Erdeljac's "Full Stack E-Commerce" Next.js 13 tutorial (see `README.md`), but it has since diverged from the tutorial in real, functioning ways: the database was migrated from MySQL/PlanetScale to **PostgreSQL**, a **Cash-on-Delivery (COD)** payment path was added alongside Stripe, order records were extended with structured customer/shipping fields, a human-readable order tracking ID was introduced, and a store logo/branding feature was added. The README itself is stale and describes the original tutorial setup (MySQL), not the current state of the repo — this is confirmed drift, not a hint to "fix."

This single application plays three roles at once:
1. **Admin dashboard** — a multi-tenant UI where a signed-in user manages one or more "stores" (catalog, billboards, orders).
2. **CMS** — the system of record for all catalog data (products, categories, billboards, sizes, colors).
3. **Public API backend** — it exposes REST-style routes under `/api/[storeId]/...` that a **separate storefront application** (not in this repo) is expected to call to render a public storefront and to create orders/checkout sessions.

# Technology Stack

| Layer | Technology | Version (from `package.json`) |
|---|---|---|
| Framework | Next.js (App Router) | `13.4.5` |
| Language | TypeScript | `5.1.3` |
| UI library | React / React DOM | `18.2.0` |
| Styling | Tailwind CSS | `3.3.2` (+ `tailwindcss-animate`) |
| Component system | shadcn/ui (Radix UI primitives, config in `components.json`) | Radix packages `^1.x` |
| ORM | Prisma | `^4.16.1` (client `@prisma/client ^4.16.1`) |
| Database | PostgreSQL (see `prisma/schema.prisma` `datasource db`) | via `DATABASE_URL` / `DATABASE_URL_UNPOOLED` (Neon-style pooled/direct URL pattern) |
| Auth | Clerk (`@clerk/nextjs`) | `^4.21.3` |
| Payments | Stripe (`stripe` SDK) | `^12.10.0`, API version pinned to `2022-11-15` in `lib/stripe.ts` |
| Image hosting | Cloudinary via `next-cloudinary` (`CldUploadWidget`) | `^4.12.0` |
| Forms/validation | `react-hook-form` `^7.45.0` + `zod` `^3.21.4` + `@hookform/resolvers` |
| Client/global state | `zustand` `^4.3.8` |
| Tables | `@tanstack/react-table` `^8.9.2` |
| Charts | `recharts` `^2.7.1` |
| HTTP client | `axios` `^1.4.0` |
| Notifications | `react-hot-toast` `^2.4.1` |
| Icons | `lucide-react` |

Node scripts (`package.json`): `dev` (`next dev`), `build` (`next build`), `start` (`next start`), `lint` (`next lint`), and `postinstall` runs `prisma generate` automatically after `npm install`.

# Repository Structure

```
app/
  (auth)/                 Route group for Clerk sign-in/sign-up pages (no dashboard chrome)
  (root)/                 Route group for the "no store yet" bootstrap flow
  (dashboard)/[storeId]/  Route group for the authenticated, per-store admin dashboard
  api/                    Route handlers — the public/admin REST API surface
  layout.tsx              Root HTML layout: ClerkProvider, ThemeProvider, Toaster, ModalProvider
actions/                  Small server-side data-aggregation functions used by the dashboard home page
components/               Shared React components (navbar, modals, store switcher, UI kit)
components/ui/            shadcn/ui-style primitive components (button, dialog, table, form, etc.)
hooks/                    Zustand stores and small client hooks
lib/                      Singletons/utilities: Prisma client, Stripe client, tracking-ID generator, cn/formatter
providers/                App-wide client providers (modal, toast, theme)
prisma/                   `schema.prisma` and migration history
public/                   Static assets
```

Route-group directories in parentheses — `(auth)`, `(root)`, `(dashboard)` — are Next.js App Router **route groups**: they organize routes and apply different layouts without adding path segments.

# Application Architecture

This is a **Next.js 13 App Router** application, mixing:
- **Server Components** for data-fetching pages (almost every `page.tsx` under `(dashboard)/[storeId]/(routes)/...` is an `async` server component that queries Prisma directly).
- **Client Components** (`"use client"`) for anything interactive: forms, tables, modals, dropdown menus. These call the API routes via `axios`, not server actions.
- **Route Handlers** (`app/api/**/route.ts`) implementing a conventional REST API per resource, scoped under a store ID path segment: `/api/[storeId]/<resource>` and `/api/[storeId]/<resource>/[resourceId]`.
- **Middleware-based auth gating** (`middleware.ts`) using Clerk's `authMiddleware`.

There are no Next.js Server Actions (`"use server"` functions) in this codebase — all mutations go through `fetch`/`axios` calls to route handlers. The `actions/` directory is not Next Server Actions; it's just a naming convention for plain async data-fetching helper functions used by the dashboard's overview page.

Multi-tenancy model: a `Store` belongs to a Clerk `userId`. Every catalog/order table (`Billboard`, `Category`, `Product`, `Size`, `Color`, `Order`) has a `storeId` foreign key. Authorization for writes is enforced ad hoc in each route handler by checking `store.findFirst({ where: { id: storeId, userId } })` before allowing a mutation — there is no row-level security or centralized authorization middleware for store ownership.

# Route Map

## Admin UI routes (require Clerk session)
| Route | Purpose |
|---|---|
| `/sign-in`, `/sign-up` | Clerk-hosted auth pages (`(auth)` group) |
| `/` | `(root)` group — if the user has no store, opens the "Create store" modal; if they have one, redirects to `/${store.id}` |
| `/[storeId]` | Dashboard overview: revenue, sales count, stock count, revenue graph |
| `/[storeId]/billboards`, `/[storeId]/billboards/[billboardId]` | List / create-edit billboards (`new` acts as create) |
| `/[storeId]/categories`, `/[storeId]/categories/[categoryId]` | List / create-edit categories |
| `/[storeId]/sizes`, `/[storeId]/sizes/[sizeId]` | List / create-edit size filter values |
| `/[storeId]/colors`, `/[storeId]/colors/[colorId]` | List / create-edit color filter values |
| `/[storeId]/products`, `/[storeId]/products/[productId]` | List / create-edit products |
| `/[storeId]/orders` | List orders, view details modal, change status |
| `/[storeId]/settings` | Store name/logo, danger-zone delete, shows the store's public API base URL |

Every `[storeId]` route is protected by `app/(dashboard)/[storeId]/layout.tsx`, which redirects to `/sign-in` if unauthenticated and to `/` if the store doesn't belong to the current user.

## API routes (`app/api/**/route.ts`)
See the **API / Server Interface** section below for full detail.

# Authentication & Authorization

**Authentication**: Clerk (`@clerk/nextjs` v4). `middleware.ts` wraps the whole app in `authMiddleware({ publicRoutes: ["/api/:path*"] })`, with a matcher that applies to virtually every non-static route. Practically:
- All **page routes** (`/`, `/[storeId]/...`, etc.) require a Clerk session; Clerk redirects unauthenticated users to sign-in.
- All **API routes** are marked `publicRoutes`, i.e. **the Clerk middleware does not block them** — each route handler is individually responsible for checking `auth()` if it needs to require a signed-in admin.

**Authorization pattern** used inside route handlers:
1. Call `const { userId } = auth()`. If missing, return 403.
2. Look up `prismadb.store.findFirst({ where: { id: params.storeId, userId } })`. If not found, return 405 ("Unauthorized").
3. Only then perform the mutation.

This pattern is applied consistently for write operations (`POST`/`PATCH`/`DELETE`) on `stores`, `billboards`, `categories`, `products`, `sizes`, `colors`. **GET** endpoints for catalog data are intentionally public (no `auth()` check) since the storefront needs to read them without a Clerk session.

**Notable gap**: `PATCH /api/[storeId]/orders/[orderId]` (order status changes, which also drive inventory archiving) has **no `auth()` check at all** — it is fully public/unauthenticated. Anyone who can reach the endpoint can mark any order CONFIRMED/DELIVERED/CANCELED and trigger the associated inventory side effects. This is a real gap in the current code (see Technical Debt / Risks).

The checkout (`/api/[storeId]/checkout`) and COD (`/api/[storeId]/cod`) order-creation endpoints are also deliberately unauthenticated (public, CORS-enabled with `Access-Control-Allow-Origin: *`) since customers on the storefront — who never sign in to this Admin app — call them directly.

The dashboard layout (`app/(dashboard)/[storeId]/layout.tsx`) performs the actual "does this store belong to this user" gate for the **UI**, independent of the API-level checks.

# Database Architecture

ORM: Prisma. Provider: `postgresql`, using `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (`directUrl`) — a pattern typical of serverless Postgres providers like Neon. Two migrations exist:
1. `20260228195737_add_order_customer_shipping_fields` — the actual baseline migration; it creates every table in one shot (`Store`, `Billboard`, `Category`, `Product`, `Order`, `OrderItem`, `Size`, `Color`, `Image`) plus the `OrderStatus`/`PaymentMethod` enums and the expanded `Order` customer/shipping columns. There is no earlier "MySQL-era" migration present in the repo — migration history starts here, meaning any prior schema history was squashed or the repo was re-initialized against Postgres at this point.
2. `20260301080140_add_store_logo` — adds `Store.logoUrl`.

## Models and relationships (plain English)

- **Store** — the tenant root. Owned by a Clerk `userId` (a string, not a foreign key into any users table — Clerk is the source of truth for users). Has an optional `logoUrl` (brand logo). Has many billboards, categories, colors, sizes, products, and orders. Everything else in the schema hangs off a `Store`.
- **Billboard** — a big promotional image + label, scoped to one store. A billboard can be attached to zero or more categories (each `Category` requires exactly one `billboardId` — not optional in the schema, despite the README claiming billboards can be "standalone").
- **Category** — belongs to a store and to exactly one billboard. Has many products.
- **Size** — a store-scoped filter/attribute value (e.g. "Large", value `"L"`). Many products can share a size.
- **Color** — same pattern as Size (name + `value`, e.g. hex code), store-scoped, many products can share a color.
- **Product** — belongs to a store, one category, **exactly one** size, and **exactly one** color (this is a simple/tutorial-style product model: there is no size/color *variant matrix* — a product is one specific size+color combo, so "red, size M shirt" and "red, size L shirt" are modeled as two separate Product rows). Has `price` (Decimal), `isFeatured` (shows on storefront homepage), `isArchived` (hides everywhere, including from the public catalog GET, and is also toggled automatically by order status changes — see Major User Flows). Has many `Image`s and many `OrderItem`s.
- **Image** — one or more image URLs (Cloudinary URLs) attached to a Product, cascade-deleted when the Product is deleted.
- **Order** — belongs to a store. Tracks fulfillment `status` (`DRAFT | CONFIRMED | DELIVERED | CANCELED`), `paymentMethod` (`STRIPE | COD`), a unique human-readable `trackingId`, `isPaid`, and a fairly rich set of customer/shipping fields added later (`customerName`, `email`, `phone`, `addressLine1/2`, `city`, `postalCode`, `country`, `customerNotes`). It also retains a **legacy** `address` string field explicitly marked in the schema as kept "for backwards compatibility" pending a full UI migration. Has many `OrderItem`s.
- **OrderItem** — a join row between `Order` and `Product` (no quantity field — see Technical Debt: each unit purchased appears to need its own `OrderItem` row, or quantity simply isn't tracked at all).

Indexes exist on essentially every foreign key and on `Order.status`, `Order.paymentMethod`, `Order.isPaid`, `Order.city`, and `Order.trackingId` (which is also unique), reflecting the order list/search screen's needs.

# Core Domain Concepts

- **Store**: a tenant/vendor. One Clerk user can own multiple stores (multi-vendor CMS, per the original tutorial's pitch). The store switcher (`components/store-switcher.tsx`) lets the admin jump between their own stores.
- **Billboard**: hero/banner image+label, meant to be displayed at the top of a storefront category page.
- **Category**: a named grouping of products, tied to one billboard for its visual banner.
- **Size / Color**: reusable attribute vocab lists per store, used as simple dropdown filters and as required single-value fields on each Product — not a variant system.
- **Product**: the sellable unit. Single price, single size, single color, multiple images, feature/archive flags.
- **Order / OrderItem**: a customer purchase, created either via Stripe Checkout or via the Cash-on-Delivery endpoint, containing one or more products through `OrderItem` join rows.

# Major User Flows

### 1. Creating a store
`(root)/(routes)/page.tsx` auto-opens `StoreModal` (`components/modals/store-modal.tsx`) if the user has no store. Form (`zod`: `name` required) → `POST /api/stores` → `auth()` check → `prismadb.store.create({ name, userId })` → client does `window.location.assign(/${store.id})`, landing in the new store's dashboard.

### 2. Managing a store
`/[storeId]/settings` → `SettingsForm` loads `initialData` (the `Store` row, fetched server-side by the page). Form fields: `logoUrl` (via `ImageUpload`/Cloudinary widget) and `name` (zod: min 2 chars, `logoUrl` optional URL). Submit → `PATCH /api/stores/[storeId]` → ownership check → `store.update`. Delete button → `AlertModal` confirm → `DELETE /api/stores/[storeId]` (a `deleteMany` scoped to `id + userId`) → redirect to `/`. Deleting a store with existing categories/products will fail at the DB level (FK `onDelete: Restrict` on most relations) — the UI just shows a generic "make sure you removed all products/categories first" toast on any error.

### 3. Creating categories
`/[storeId]/categories/[categoryId]` page (`new` for create) renders `CategoryForm`, which needs an existing `Billboard` to attach to (dropdown of billboards for the store). Submit → `POST`/`PATCH /api/[storeId]/categories(/[categoryId])` with ownership check → Prisma create/update.

### 4. Creating products
`/[storeId]/products/[productId]` → `ProductForm`. Requires: at least one image (Cloudinary upload via `ImageUpload`), `name`, `price` (coerced number ≥ 1), `categoryId`, `sizeId`, `colorId`, plus `isFeatured`/`isArchived` checkboxes. Submit → `POST /api/[storeId]/products` (create) or `PATCH /api/[storeId]/products/[productId]` (update, which does a full `images.deleteMany` + `createMany` replace rather than a diff).

### 5. Managing variants (size/color)
Sizes and Colors are managed as flat store-scoped lists (`/[storeId]/sizes`, `/[storeId]/colors`), each with `name` + `value`. They're referenced by Products as single required foreign keys, not as a many-to-many variant matrix — "variant management" in this codebase means picking one size and one color per Product row, not generating SKUs across combinations.

### 6. Publishing products
There is no explicit "publish" step distinct from creation. A Product is publicly visible via the catalog GET endpoints whenever `isArchived: false` (the GET route filters `isArchived: false` unconditionally). `isFeatured: true` additionally surfaces it wherever the storefront queries `isFeatured=true` (e.g. a homepage). Setting `isArchived: true` (manually, or automatically via order confirmation — see below) is the closest concept to "unpublish."

### 7. Receiving orders (two payment paths)
- **Stripe path**: storefront calls `POST /api/[storeId]/checkout` with `productIds`. The route re-fetches product data server-side (trusting DB prices, not client-sent prices — good practice), builds Stripe `line_items` in USD, creates an `Order` row (`status: DRAFT`, `paymentMethod: STRIPE`, `isPaid: false`, a random 12-char tracking id via `randomUUID()`), then creates a Stripe Checkout Session with `metadata.orderId` and returns the session URL to redirect the customer to.
- **COD path**: storefront calls `POST /api/[storeId]/cod` with `productIds`, customer info (`name/phone/email`), and shipping info (`line1/line2/city/postalCode/country/notes`). The route computes `totalPrice` server-side from DB prices, generates a formatted tracking ID via `lib/trackingId.ts` (`ORD-YYMMDD-XXXXXX`), creates an `Order` (`paymentMethod: COD` by default, `isPaid: false`, `status: DRAFT`) with the structured customer/shipping fields populated plus a legacy `address` string built for display, and returns full order details including a computed `totalPrice`.

Both endpoints are public and CORS-enabled (`Access-Control-Allow-Origin: *`), since they're called directly from the separate storefront app's browser context, not from this Admin app.

### 8. Processing payments (Stripe)
Handled entirely by Stripe Checkout (hosted payment page) — this repo never touches card details. The Order stays `isPaid: false` / `DRAFT` until the webhook confirms payment.

### 9. Stripe webhook handling
`POST /api/webhook` verifies the signature (`stripe.webhooks.constructEvent` with `STRIPE_WEBHOOK_SECRET`) and, on `checkout.session.completed`, updates the `Order` (matched by `session.metadata.orderId`) to `isPaid: true`, `status: CONFIRMED`, and fills in customer name/email/phone/address fields from Stripe's `customer_details` (both the new structured columns and the legacy `address` string). Note: this webhook path does **not** run the inventory-archiving logic that the manual order-status PATCH route runs (see Technical Debt) — it sets `status: CONFIRMED` directly via `order.update`, bypassing the `PATCH /orders/[orderId]` handler entirely.

### 10. How the storefront accesses admin-managed data
The storefront (a separate app, not in this repo) is expected to call this repo's `/api/[storeId]/...` GET endpoints directly as a public JSON API (CORS is not explicitly configured on most catalog GETs, but they're implicitly public since they skip the `auth()` check), plus the checkout/COD POST endpoints to create orders, plus it must be configured with `FRONTEND_STORE_URL` (this repo → storefront redirect target after Stripe checkout) as an environment variable on this side.

# API / Server Interface

All paths are relative to the deployed origin. `{storeId}` etc. are Prisma UUIDs. "Auth" = Clerk session + store-ownership check unless noted.

| Method | Path | Purpose | Auth | Request shape | Response shape |
|---|---|---|---|---|---|
| POST | `/api/stores` | Create a store | Clerk only (no ownership check needed — new record) | `{ name }` | `Store` |
| PATCH | `/api/stores/{storeId}` | Update store name/logo | Clerk + ownership | `{ name, logoUrl? }` | `Store` |
| DELETE | `/api/stores/{storeId}` | Delete a store | Clerk + ownership | — | Prisma `deleteMany` batch result |
| GET | `/api/stores/{storeId}` | Public store lookup (id/name/logoUrl only) | **None** | — | `{ id, name, logoUrl }` |
| POST | `/api/{storeId}/billboards` | Create billboard | Clerk + ownership | `{ label, imageUrl }` | `Billboard` |
| GET | `/api/{storeId}/billboards` | **Dead/disabled** — handler is commented out | — | — | 404 (no handler) |
| GET | `/api/{storeId}/billboards/{billboardId}` | Get one billboard | None | — | **Buggy**: queries by `storeId`, not `billboardId` — returns *some* billboard for the store, not the requested one |
| PATCH | `/api/{storeId}/billboards/{billboardId}` | Update billboard | Clerk + ownership | `{ label, imageUrl }` | `Billboard` |
| DELETE | `/api/{storeId}/billboards/{billboardId}` | Delete billboard | Clerk + ownership | — | `Billboard` |
| POST / GET / PATCH / DELETE | `/api/{storeId}/categories(/{categoryId})` | Standard CRUD | POST/PATCH/DELETE: Clerk + ownership; GET: public | `{ name, billboardId }` | `Category` (GET list includes `billboard`) |
| POST / GET / PATCH / DELETE | `/api/{storeId}/sizes(/{sizeId})` | Standard CRUD | same pattern | `{ name, value }` | `Size` |
| POST / GET / PATCH / DELETE | `/api/{storeId}/colors(/{colorId})` | Standard CRUD | same pattern | `{ name, value }` | `Color` |
| POST | `/api/{storeId}/products` | Create product | Clerk + ownership | `{ name, price, categoryId, colorId, sizeId, images: [{url}], isFeatured?, isArchived? }` | `Product` |
| GET | `/api/{storeId}/products` | Public catalog list with filters | None | query: `categoryId?, colorId?, sizeId?, isFeatured?` | `Product[]` (always `isArchived: false`, includes images/category/color/size) |
| GET | `/api/{storeId}/products/{productId}` | Get one product | None | — | `Product` with relations |
| PATCH | `/api/{storeId}/products/{productId}` | Update product (full image replace) | Clerk + ownership | same as create | `Product` |
| DELETE | `/api/{storeId}/products/{productId}` | Delete product | Clerk + ownership | — | `Product` |
| POST | `/api/{storeId}/checkout` | Create Stripe Checkout session + DRAFT order | **None** (public, CORS `*`) | `{ productIds: string[] }` | `{ url }` (Stripe session URL) |
| POST | `/api/{storeId}/cod` | Create a Cash-on-Delivery order | **None** (public, CORS `*`) | `{ productIds, paymentMethod?, customer?: {name,phone,email}, shipping?: {line1,line2,city,postalCode,country,notes}, notes? }` | Full order summary incl. `orderId, trackingId, status, products[], totalPrice, store` |
| PATCH | `/api/{storeId}/orders/{orderId}` | Change order status (and side-effect inventory) | **None — unauthenticated, no ownership check** | `{ status }` | Updated `Order` |
| POST | `/api/webhook` | Stripe webhook receiver | Stripe signature verification only | Stripe event payload | `200` empty body |

The Admin UI's Settings page literally surfaces `${origin}/api/${storeId}` to the store owner as "your API base URL" — confirming this API is intentionally meant to be consumed externally.

# Stripe / Payment Architecture

- Stripe client instantiated once in `lib/stripe.ts` with a **pinned API version `2022-11-15`** (older than the installed `stripe` SDK's default — intentional pinning, not necessarily a bug, but worth knowing when upgrading the SDK).
- Checkout Sessions are created server-side in `/api/[storeId]/checkout`; line item prices come from the DB (`product.price`), not from client input — this prevents price tampering.
- Currency at Checkout-session time is hardcoded `"USD"` (`price_data.currency: "USD"`) even though the rest of the app (dashboard formatter) displays amounts in **PKR** (`lib/utils.ts` `formatter` uses `en-PK` / `PKR`) — a real currency-consistency gap (see Technical Debt).
- Payment confirmation is entirely webhook-driven (`/api/webhook`), matched via `session.metadata.orderId`. There is no polling/manual "check payment status" flow in this repo.
- COD is a fully separate, non-Stripe payment path added later; it never touches Stripe at all and marks orders `isPaid: false` until presumably marked otherwise manually via the order status PATCH (note: the status PATCH endpoint updates `status` only, never `isPaid` — so COD orders may never flip `isPaid: true` through the current UI).

# Image / File Storage

- **Cloudinary**, via `next-cloudinary`'s `CldUploadWidget` (`components/ui/image-upload.tsx`). Upload preset is hardcoded client-side: `uploadPreset="tbck4c3k"`.
- `next.config.js` whitelists `res.cloudinary.com` in `images.domains` for `next/image`.
- On upload, the widget returns `result.info.secure_url`, which is stored as a plain string URL in Postgres (`Image.url` for products, `Billboard.imageUrl`, `Store.logoUrl`). This app never stores image bytes itself — Cloudinary is the actual file store, and this DB just tracks URLs.
- `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` env var configures which Cloudinary account/cloud is used (client-exposed, as required by the widget).

# State Management

- **Zustand** is used for small pieces of client-only UI state, all via the `create()` pattern:
  - `useStoreModal` (`hooks/use-store-modal.tsx`) — drives the "Create store" modal; **actively used** (`providers/modal-provider.tsx`, `store-switcher.tsx`, `(root)` setup page).
  - `useCategoryModal`, `useProductModal`, `useActiveStore` (`hooks/*.tsx`) — defined with full open/edit/close APIs, but only `useCategoryModal` is even *imported* anywhere (in `categories/.../cell-action.tsx`) and even there it is imported but **never called** — categories/products are actually edited by navigating to a dedicated `[id]` page/route, not via these modals. These three hooks are dead/unused state, likely leftover from an earlier or partially-abandoned "edit via modal" design.
- No global server-state/cache library (no React Query/SWR) — server data is fetched either in Server Components directly via Prisma, or via one-off `axios` calls in client components followed by `router.refresh()`.

# Forms & Validation

- `react-hook-form` + `zod` + `@hookform/resolvers/zod` throughout every create/edit form (`StoreModal`, `SettingsForm`, `BillboardForm`, `CategoryForm`, `ProductForm`, `SizeForm`, `ColorForm`).
- Validation is **client-side only** via zod schemas colocated in each form component; the API route handlers re-validate with plain manual `if (!field)` checks (no shared zod schema between client and server — duplication, not a shared contract).
- `ProductForm`'s zod schema: `price: z.coerce.number().min(1)`, `images: z.object({url: z.string()}).array()`, required `categoryId/colorId/sizeId`.
- `SettingsForm` uses a `z.preprocess` to make an empty-string `logoUrl` resolve to `undefined` (optional URL) instead of failing `z.string().url()`.

# UI Architecture

- Built on **shadcn/ui** conventions (`components.json` present, primitives in `components/ui/*` wrapping Radix UI: dialog, dropdown-menu, popover, select, tabs, checkbox, avatar, label, separator).
- Shared page-level building blocks: `Heading`, `Separator`, `DataTable` (wraps `@tanstack/react-table` with a single-column text filter via `searchKey`), `Modal` (base dialog used by `AlertModal`, `StoreModal`, `OrderDetailsModal`), `ApiAlert`/`ApiList` (renders the public API URL list shown at the bottom of each catalog list page for the admin's reference).
- Each catalog resource (`billboards`, `categories`, `sizes`, `colors`, `products`) follows an identical list-page structure: `page.tsx` (server component, Prisma query + formatting) → `client.tsx` ("Add New" button + `DataTable`) → `columns.tsx` (column defs + `CellAction` cell) → `components/cell-action.tsx` (row dropdown: copy id / edit / delete) → a separate `[id]/page.tsx` + `[id]/components/*-form.tsx` for create/edit (id `"new"` conventionally means create, though Prisma lookups for `"new"` would simply return `null`, which the form components treat as "no initialData").
- Orders is the one resource that deviates from this pattern: it has no create/edit page (orders are created by the storefront/webhook, not by the admin) and instead has a `order-details-modal.tsx` for read-only detail viewing plus a status-change dropdown.
- Loading states: each route directory has a `loading.tsx` (Next.js App Router loading UI) using `react-spinners`, shown automatically during server-component data fetches.
- Theming: `next-themes` (`ThemeProvider`, `ThemeToggle`) for light/dark mode, applied via a `class` strategy.
- Toasts: `react-hot-toast` (`ToastProvider` mounted once at root) used for all success/error feedback after `axios` calls.

# Environment Variables

(From `README.md`'s documented list plus variables actually referenced in code — no `.env` or `.env.example` file exists in the repo, so this list is reconstructed from source.)

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk public key for client-side auth widgets |
| `CLERK_SECRET_KEY` | Clerk server-side secret |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` / `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Clerk hosted page routes (`/sign-in`, `/sign-up`) |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` / `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | Post-auth redirect targets |
| `DATABASE_URL` | Pooled Postgres connection string (Prisma `datasource.url`) |
| `DATABASE_URL_UNPOOLED` | Direct/unpooled Postgres connection string (Prisma `datasource.directUrl`, used for migrations) — **not documented in README**, discovered only in `schema.prisma`; must be set or `prisma migrate`/`db push` will fail |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name for the upload widget |
| `STRIPE_API_KEY` | Stripe secret key (`lib/stripe.ts`) |
| `STRIPE_WEBHOOK_SECRET` | Verifies signatures on incoming Stripe webhook events |
| `FRONTEND_STORE_URL` | Base URL of the separate storefront app; used to build Stripe Checkout `success_url`/`cancel_url` |
| `RESEND_API_KEY` | Server-side Resend API key used for merchant order notifications |
| `RESEND_FROM_EMAIL` | Verified Resend sender address for merchant order notifications |
| `RESEND_TEST_RECIPIENT` | Optional development recipient override; when set, notifications are sent here instead of the Store owner's Clerk email |

**Do not** commit or paste actual secret values into any file — none are present in the repo currently (confirmed no `.env*` files exist).

# Storefront Integration

This repo has **no code reference to, or import from, a storefront repository** — the relationship is entirely at the HTTP boundary:
- The storefront (external, separate codebase) reads catalog data (billboards, categories, products, sizes, colors) via `GET /api/{storeId}/...` endpoints on this app.
- The storefront initiates purchases by calling `POST /api/{storeId}/checkout` (Stripe) or `POST /api/{storeId}/cod` (Cash on Delivery) on this app.
- This app redirects the customer back to the storefront after Stripe Checkout via `FRONTEND_STORE_URL` (`/cart?success=1` / `/cart?canceled=1`), and the storefront's own domain must be configured for CORS to work — currently these two POST endpoints allow `Access-Control-Allow-Origin: "*"` (any origin), not scoped to the actual storefront domain.
- Stripe calls back **this app's** `/api/webhook` directly (not the storefront) to confirm payment.
- The admin Settings page surfaces this app's own API base URL to the store owner, implying the intended usage pattern (giving that base URL to whoever configures the storefront's API client) is manual/documentation-driven, not automated (no shared config, no API key handshake between the two apps).
- Two real defects affect storefront integration today: the billboard list GET is disabled (commented out) and the single-billboard GET is misimplemented (ignores `billboardId`) — see Technical Debt.

# Development Workflow

- **Install**: `npm i` (root `postinstall` script automatically runs `prisma generate`).
- **Environment**: create a `.env` (or `.env.local`) with the variables listed above — no example file currently exists in the repo, so one must be reconstructed manually.
- **Database setup**: needs a reachable PostgreSQL instance (README still says PlanetScale/MySQL — outdated; current schema targets Postgres, e.g. Neon-style pooled/direct URLs). Run `npx prisma generate` (also runs automatically post-install) and `npx prisma migrate deploy` (to apply existing migrations) or `npx prisma db push` (to sync schema without a migration history) depending on workflow preference.
- **Migrations**: two exist under `prisma/migrations/`; use `npx prisma migrate dev` to create new ones locally against a dev database.
- **Seeding**: no seed script exists in `package.json` or a `prisma/seed.*` file — there is currently no automated way to populate sample data; the only path is manually creating a store then adding catalog items through the UI/API.
- **Dev server**: `npm run dev` (Next.js dev server, default port 3000).
- **Build**: `npm run build`; **start**: `npm run start` for production mode.
- **Lint**: `npm run lint` (`next lint`, config `eslint-config-next` via `.eslintrc.json`). There is no separate `typecheck` script; type errors would surface via `next build` or an editor/IDE, or by running `npx tsc --noEmit` manually.
- **Required external services** to run meaningfully: Clerk (auth), a Postgres database, Stripe (test mode acceptable, per README's mention of Stripe test cards), Cloudinary (image uploads), and — for full storefront-facing flows — a running instance of the separate storefront app plus its URL in `FRONTEND_STORE_URL`.

# Important Files

| File | Responsibility | Why It Matters |
|---|---|---|
| `prisma/schema.prisma` | Full data model and relationships | The single source of truth for every entity in the system; read this first |
| `middleware.ts` | Clerk route protection config | Explains why API routes are all "public" at the middleware layer and rely on per-route `auth()` checks |
| `lib/prismadb.ts` | Prisma client singleton | Used by every server component and API route; standard Next.js dev-mode singleton pattern to avoid connection exhaustion |
| `lib/stripe.ts` | Stripe SDK client, pinned API version | Central point for all Stripe interaction |
| `lib/trackingId.ts` | Human-readable order tracking ID generator | Used only by the COD flow (Stripe checkout uses a different, simpler ID scheme — an inconsistency worth knowing) |
| `app/api/[storeId]/checkout/route.ts` | Stripe order/session creation | Core of the Stripe purchase flow and the storefront's main write path |
| `app/api/[storeId]/cod/route.ts` | Cash-on-delivery order creation | Core of the non-Stripe purchase flow; most complex/most recently modified route |
| `app/api/webhook/route.ts` | Stripe payment confirmation | The only place `isPaid`/`CONFIRMED` gets set for Stripe orders |
| `app/api/[storeId]/orders/[orderId]/route.ts` | Order status transitions + inventory side effects | Where `isArchived` gets flipped automatically; also the unauthenticated-endpoint risk |
| `app/(dashboard)/[storeId]/layout.tsx` | Per-store admin authorization gate for the UI | Explains the redirect behavior new developers will hit immediately when testing |
| `app/(dashboard)/[storeId]/(routes)/products/[productId]/components/product-form.tsx` | Product create/edit form | Clarifies the "single size + single color per product" model, easy to misread as a variant system |
| `components/ui/image-upload.tsx` | Cloudinary upload widget wrapper | Explains where the hardcoded upload preset lives and how image URLs enter the system |
| `README.md` | Original tutorial instructions | Useful for historical context but **stale** (MySQL/PlanetScale) — cross-check everything against actual code |

# Technical Debt / Risks

**Confirmed issues (verified directly in code):**
- `GET /api/[storeId]/billboards/[billboardId]` queries `billboard.findFirst({ where: { storeId: params.billboardId } })` — it uses the wrong param and effectively ignores which billboard was requested, returning an arbitrary billboard for the store instead. The correct implementation exists in the file but is **commented out** directly below the broken one.
- `GET /api/[storeId]/billboards` (list) handler is entirely commented out — there is currently no way for an external client (i.e. the storefront) to list all billboards for a store via this API. The admin UI itself doesn't need this route (it queries Prisma directly from the server component), so this gap is invisible in the Admin app itself and would only surface as a storefront bug.
- `PATCH /api/[storeId]/orders/[orderId]` has no `auth()`/ownership check whatsoever — any caller who knows an `orderId` can change its status (and trigger the inventory-archive/restore side effect) without authentication.
- Stripe Checkout line items are hardcoded to `currency: "USD"`, while the rest of the app (dashboard `formatter`, COD flow's implicit country default `"PK"`) is oriented around PKR/Pakistan — a currency mismatch between the two payment paths.
- The order status PATCH route never sets `isPaid`; COD orders have no code path (in this repo) that flips `isPaid: true`, so "paid" status for COD orders would need to be handled outside this codebase (or is simply not tracked).
- `OrderItem` has no quantity field — multiple units of the same product per order aren't distinguishable from one unit each; either the storefront always sends one `productId` per unit purchased, or quantity tracking doesn't exist.

**Suspicious / worth double-checking before relying on them:**
- The `Order.address` field is explicitly commented in the schema as "legacy... keep for backwards compatibility... remove after UI migrates fully" — multiple routes (`cod`, `webhook`) still populate both `address` and the structured fields in parallel, suggesting the "full migration" mentioned in that comment hasn't happened yet.
- `trackingId` generation is inconsistent between payment paths: Stripe checkout uses a bare `randomUUID().replace(/-/g,'').slice(0,12)` (no collision-retry, no format), while COD uses the more deliberate `createTrackingId()` helper (`ORD-YYMMDD-XXXXXX` format). Neither path retries on a (rare) unique-constraint collision against `Order.trackingId @unique`.
- `app/api/stores/[storeId]/route.ts` GET handler has a stray `console.log("RequestHit")` — looks like leftover debugging output shipped to production logs.

**Outdated approaches:**
- `README.md` describes MySQL + PlanetScale; actual schema/config is PostgreSQL with pooled/direct URLs — anyone following the README's DB setup instructions literally will be misled.
- Next.js 13.4.5 App Router is now several major versions behind current Next.js releases; Clerk `^4.x`, Prisma `^4.x`, and Stripe SDK `^12.x` are all multiple majors behind their current lines. This is noted per the task's request to flag areas where upgrading could matter later — **no upgrade was performed**.

**Unused / dead code:**
- `hooks/use-category-modal.tsx`, `hooks/use-product-modal.tsx`, `hooks/use-active-store.tsx` — fully defined Zustand stores that are either never imported (`use-product-modal`, `use-active-store`) or imported but never invoked (`use-category-modal`, imported in `categories/components/cell-action.tsx` with no call site). These appear to be remnants of an earlier "edit via modal" UI pattern that was replaced by dedicated `[id]` pages.
- The commented-out `GET` handlers in `app/api/[storeId]/billboards/route.ts` and the commented-out correct version in `app/api/[storeId]/billboards/[billboardId]/route.ts`.

**Security considerations:**
- Unauthenticated order-status mutation endpoint (above) — the most significant security gap found.
- CORS on `checkout` and `cod` endpoints is wide open (`Access-Control-Allow-Origin: *`) rather than scoped to the known storefront origin; combined with the order-status gap, this widens the attack surface for order tampering from arbitrary origins.
- Store ownership checks are duplicated by hand in every route handler rather than centralized — any future new route that forgets the `store.findFirst({ userId })` check would silently become an authorization bypass. Nothing currently found is missing this check except the order-status route noted above, but the pattern itself is fragile to maintain.

# What I Should Re-Learn First

Recommended reading order for someone returning after a break:
1. `prisma/schema.prisma` — get the data model fixed in your head first; everything else refers back to it.
2. `middleware.ts` + `app/(dashboard)/[storeId]/layout.tsx` — understand the two-layer auth model (Clerk middleware vs. per-route/per-layout ownership checks).
3. One full CRUD slice end-to-end, e.g. **categories**: `app/(dashboard)/[storeId]/(routes)/categories/page.tsx` → `components/client.tsx` → `components/columns.tsx` → `components/cell-action.tsx` → `[categoryId]/page.tsx` → `[categoryId]/components/category-form.tsx` → `app/api/[storeId]/categories/route.ts` and `[categoryId]/route.ts`. Every other catalog resource (billboards, sizes, colors, products) repeats this exact shape.
4. `app/(dashboard)/[storeId]/(routes)/products/[productId]/components/product-form.tsx` — the most complex form; clarifies the single-size/single-color product model and the Cloudinary image flow.
5. The order/payment trio together: `app/api/[storeId]/checkout/route.ts`, `app/api/[storeId]/cod/route.ts`, `app/api/webhook/route.ts`, then `app/api/[storeId]/orders/[orderId]/route.ts` — this is where the two payment paths, the tracking ID schemes, and the inventory-archiving side effect all connect.
6. `app/(dashboard)/[storeId]/(routes)/orders/` UI (`page.tsx`, `columns.tsx`, `order-details-modal.tsx`, `cell-action.tsx`) — how admins view/act on what the above created.
7. `actions/*.ts` + `app/(dashboard)/[storeId]/(routes)/page.tsx` — the dashboard home page's revenue/sales/stock aggregation logic.
8. The Technical Debt / Risks section above — know the known gaps before assuming any given endpoint is production-safe.

# Mental Model

A Clerk-authenticated user signs in and either creates or selects a **Store** (a tenant). Inside a store, the admin manages a small, flat catalog: **Billboards** (banner images tied to categories), **Categories** (each pointing at one billboard), **Sizes** and **Colors** (simple attribute lists), and **Products** (each with one category, one size, one color, a price, and one-or-more Cloudinary-hosted images). All of this is stored in Postgres via Prisma and is both rendered in this app's own dashboard (server components querying Prisma directly) and exposed as a public-ish REST API under `/api/{storeId}/...` for a separate, external storefront application to consume.

On the storefront, a customer builds a cart and checks out through one of two paths this Admin app exposes: **Stripe** (`/api/{storeId}/checkout`, which creates a DRAFT `Order` and hands back a Stripe-hosted Checkout URL; payment is later confirmed asynchronously when Stripe calls this app's `/api/webhook`, which flips the order to `CONFIRMED`/`isPaid: true`) or **Cash on Delivery** (`/api/{storeId}/cod`, which creates the `Order` immediately with full customer/shipping details and a human-readable tracking ID, no external payment step). Either way, an `Order` ends up with one or more `OrderItem` rows linking it to the purchased `Product`s.

Back in the Admin dashboard, the store owner sees these orders in the Orders table, can drill into details, and can change an order's status through a dropdown, which `PATCH`es `/api/{storeId}/orders/{orderId}` — a route that, notably, has no authentication guard today and also automatically archives (or un-archives) the purchased products' inventory when the status crosses into/out of `CONFIRMED`. The dashboard's home page then aggregates all of this — total revenue, sales count, stock count, a monthly revenue chart — purely from `isPaid`/`isArchived` flags on `Order`/`Product`, via small helper functions in `actions/`.

Everything the storefront needs from this system — catalog reads, billboard/category browsing, order creation — flows through the `/api/{storeId}/...` surface; nothing in this repo imports or knows about the storefront's own code, only its URL (`FRONTEND_STORE_URL`) for post-payment redirects.
