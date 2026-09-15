# CLAUDE.md — Admin / CMS / API Repository

Read `docs/PROJECT_BRIEF.md` first for the full reverse-engineered architecture. Treat current source code as the final authority; the README is partially stale.

## Repository Identity

This Next.js 13.4.5 App Router repository is simultaneously:

- authenticated Admin dashboard
- CMS/system of record
- REST API backend for a separate Storefront repository

Current backend stack: Prisma + PostgreSQL, Clerk, Stripe, Cloudinary.

## Working Rules

- Inspect before editing.
- Preserve current architecture and behavior unless the user asks for a redesign.
- Do not upgrade dependencies or modernize Next.js patterns as collateral work.
- Do not convert route handlers to Server Actions unless explicitly requested.
- Avoid unrelated cleanup/refactors.
- Never assume tutorial README behavior is still correct.
- Never invent API fields, DB columns, or backend behavior.
- If an Admin change affects the Storefront API contract, identify that before implementation.

## Important Domain Constraint

`Product` is a fixed sellable row with one Category, one Size, one Color, one price, and images. There is no true product-variant matrix and no quantity field on OrderItem.

## Multi-Tenancy

`Store` is the tenant root and belongs to Clerk `userId`. Admin write routes generally authenticate and verify Store ownership. Preserve store scoping for every new query/mutation.

## Critical Flows

Stripe:

`Storefront -> /checkout -> DRAFT Order -> Stripe Checkout -> /api/webhook -> isPaid=true + CONFIRMED`

COD:

`Storefront -> /cod -> DRAFT COD Order -> immediate order/tracking response`

For payment/order changes, inspect both the Admin endpoint and expected Storefront payload/response.

## Known Existing Risks

Do not silently fix these during unrelated tasks:

- order-status PATCH is unauthenticated
- billboard list GET is disabled
- billboard-by-id GET is misimplemented
- Stripe Checkout uses USD while other UI is PKR-oriented
- COD does not normally set `isPaid=true`
- tracking ID formats differ by payment path
- stale README database instructions

## Validation

Use existing lint/build/type checks when they are relevant and safe.

Do not install Playwright/Chromium or attempt authenticated manual flows without credentials. For browser verification, give the user a precise manual test checklist.

## Response After Changes

Always summarize:

1. files changed
2. behavior changed
3. API/schema impact
4. Storefront impact
5. validation run
6. manual testing still required
