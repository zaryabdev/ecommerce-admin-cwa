# AGENTS.md — Admin / CMS / API Repository

## Role of This Repository

This repository is the backend system of record and authenticated Admin/CMS for the e-commerce project. It also exposes the REST API consumed by the separate Storefront repository.

Before making changes, read:

1. `docs/PROJECT_BRIEF.md`
2. this `AGENTS.md`
3. relevant source files for the requested task

If documentation conflicts with source code, source code wins. The README is historical/tutorial context and is known to be stale.

## Current Stack

- Next.js 13.4.5 App Router
- React 18.2
- TypeScript 5.1.3
- Tailwind CSS 3.3.2
- shadcn/ui / Radix
- Prisma 4.16.x
- PostgreSQL
- Clerk
- Stripe Checkout + webhooks
- Cloudinary
- React Hook Form + Zod
- Zustand for limited UI state

Do not assume the tutorial's old MySQL/PlanetScale setup is still current.

## Architectural Rules

- Dashboard pages are primarily Server Components that query Prisma directly.
- Interactive forms/tables/modals are Client Components.
- Mutations use REST route handlers + axios/fetch; this repo does not currently use Next.js Server Actions.
- The Admin API is part of the Storefront contract. API changes may require Storefront changes.
- A `Store` is the tenant root and is owned by a Clerk `userId`.
- Catalog/order records are store-scoped by `storeId`.
- Product is one fixed size + one fixed color; do not assume a variant matrix exists.

## Change Discipline

For every task:

1. Inspect the relevant existing flow end-to-end before editing.
2. Preserve existing architecture unless the user explicitly requests architectural change.
3. Make the smallest coherent change that satisfies the requirement.
4. Do not perform unrelated cleanup, dependency upgrades, or refactors.
5. Check whether the change alters the Storefront API contract.
6. If it does, identify the required Storefront changes before implementing a breaking change.
7. Never invent backend fields/endpoints that are not present in source or explicitly supplied by the user.

## Store Ownership / Authorization

For Admin-only write endpoints, follow the existing pattern unless the task explicitly changes authorization:

- obtain Clerk `userId`
- reject missing auth
- verify requested Store belongs to that user
- then mutate store-scoped data

Do not accidentally expose a new mutation route publicly.

Public catalog GETs and public customer checkout/COD routes exist intentionally because the separate Storefront needs them.

## Database / Prisma Rules

- Current DB provider is PostgreSQL.
- `prisma/schema.prisma` is the authoritative data model.
- Do not alter schema for a UI-only task.
- Any schema change must include migration impact and cross-repo/API impact.
- Do not use `db push` as a substitute for a proper migration in an implementation task unless explicitly requested.
- Preserve existing relation semantics and cascade/restrict behavior unless the task requires a change.

## Payments and Orders

There are two purchase paths:

### Stripe

Storefront -> `POST /api/[storeId]/checkout` -> DRAFT Order -> Stripe Checkout -> `/api/webhook` -> paid/CONFIRMED.

### COD

Storefront -> `POST /api/[storeId]/cod` -> DRAFT COD Order returned immediately with tracking information.

Payment/order code is cross-repo and business-critical. When modifying it, trace:

- Storefront payload
- Admin route validation
- authoritative DB price lookup
- Order/OrderItem creation
- tracking ID
- status/isPaid behavior
- Stripe webhook where relevant
- Storefront response shape

Never trust client-supplied prices.

## Known Current Issues

These are known existing conditions, not permission to fix them during unrelated work:

- unauthenticated order-status PATCH route
- broken billboard-by-id behavior
- disabled billboard list GET
- Stripe currency is USD while project UI/COD orientation is PKR
- COD has no normal code path that marks `isPaid=true`
- no OrderItem quantity field
- inconsistent Stripe vs COD tracking ID format
- stale README DB instructions
- some dead hooks/debug/commented code

If a requested task touches one of these, call out the interaction explicitly.

## Storefront Contract

The Storefront consumes public Admin routes for:

- Store branding
- categories
- billboards
- products
- colors
- sizes
- Stripe checkout
- COD order creation

Before changing a response shape, route, filter name, enum, Product field, Order field, or checkout payload, verify Storefront impact.

## Environment Variables

Expected Admin variables include:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- Clerk sign-in/sign-up redirect variables
- `DATABASE_URL`
- `DATABASE_URL_UNPOOLED`
- `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`
- `STRIPE_API_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `FRONTEND_STORE_URL`

Never expose or commit secret values.

## Testing Expectations

Use repository-local static validation where appropriate, such as lint/type/build commands already supported by the project.

Do not install browser binaries or attempt authenticated browser automation just to validate a UI flow. When manual browser verification is needed, provide the exact test steps for the user to run.

Do not modify application behavior merely to make tests easier.

## Implementation Reports

After a coding task, report concisely:

- what changed
- files changed
- API/schema impact
- Storefront impact, if any
- validation performed
- manual verification still needed
- any pre-existing issue encountered but intentionally left unchanged
