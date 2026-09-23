## Super Admin / Platform Billing Prerequisites

- [x] **1. Store Billing Profile**
  - [x] Prisma model
  - [x] Migration
  - [x] Store relation
  - [x] Read/update API
  - [x] Validation
  - [x] Store Settings Billing UI
  - [x] Existing-data compatibility
  - [x] Verification
- [x] **2. Immutable Order Monetary Snapshots**
  - [x] Prisma monetary snapshot fields
  - [x] Migration
  - [x] COD authoritative price capture
  - [x] Quantity-aware line totals
  - [x] Order subtotal/total snapshot
  - [x] Currency snapshot
  - [x] Existing-order compatibility
  - [x] Current order response/display consistency
  - [x] Verification
- [ ] 3. Monthly Eligible Sales Definition + Backend Calculation
- [ ] 4. Platform Authentication / Authorization + Platform APIs
- [ ] 5. Billing Plans + Store Assignment + Invoice Domain
- [ ] 6. Super Admin Application Implementation

## Release 1 TODO — Locked Priority

- [ ] **1. Stabilize existing Retail core**

    - [ ] **Product quantity / stock — NEXT**

        - [x] Add quantity to Product creation
        - [x] Add quantity to Product edit
        - [x] Persist quantity in Admin/API + Prisma
        - [x] Show available quantity appropriately in Storefront
        - [x] Prevent adding more than available stock to cart
        - [x] Validate quantity again when placing the order
        - [x] Reduce stock when Admin confirms an order
        - [x] Restore stock when Admin cancels a confirmed order
        - [x] Handle `0` quantity / out-of-stock UI
        - [x] Decide behavior if cart contains an item whose stock changed before checkout
        - [x] Preserve historical OrderItem data even when Product quantity later changes

    - [ ] Verify Store creation flow
    - [ ] Verify Products / Categories
    - [ ] Verify cart / checkout
    - [ ] Verify order creation
    - [ ] Verify merchant new-order email
    - [ ] Verify Admin order management
    - [ ] Fix only genuine blockers/regressions

- [ ] **2. Minimal Super Admin Portal**

    - [ ] Create third frontend repo
    - [ ] Reuse existing Admin/API backend
    - [ ] Super Admin authentication/authorization
    - [ ] Store listing
    - [ ] Store detail
    - [ ] Store owner information
    - [ ] Order metrics
    - [ ] Sales metrics
    - [ ] Billing plan assignment/change
    - [ ] Monthly invoice generation
    - [ ] Send / mark invoice
    - [ ] Invoice history
    - [ ] Keep billing manual for Release 1

- [ ] **3. Mobile-friendly Merchant Admin**

    - [ ] Responsive navigation
    - [ ] Orders
    - [ ] Products
    - [ ] Categories
    - [ ] Store settings
    - [ ] Tables/cards/actions
    - [ ] Mobile/tablet usability

- [ ] **4. Storefront visual redesign**

    - [ ] Homepage
    - [ ] Navigation
    - [ ] Product listing
    - [ ] Category pages
    - [ ] Product detail
    - [ ] Cart
    - [ ] Checkout
    - [ ] Order confirmation
    - [ ] Mobile-first polish

- [ ] **5. Theme-ready Storefront architecture**

    - [ ] Separate branding/configuration from layout
    - [ ] Theme configuration boundary
    - [ ] Logo
    - [ ] Brand colors
    - [ ] Necessary appearance settings
    - [ ] Ship **one polished default theme**
    - [ ] Do not build multiple selectable themes yet

- [ ] **6. Production Release**

    - [ ] Production environment configuration
    - [ ] Prisma migration verification
    - [ ] Production database/data-safety checks
    - [ ] Clerk configuration
    - [ ] Resend configuration
    - [ ] Cloudinary configuration
    - [ ] Deploy Admin/API
    - [ ] Deploy Storefront
    - [ ] Deploy Super Admin
    - [ ] End-to-end manual testing
    - [ ] Test fresh Store creation
    - [ ] Test merchant onboarding
    - [ ] Release

### Post-Release

- [ ] Restaurant business type
- [ ] Restaurant-specific Storefront/Menu UI
- [ ] Restaurant guest-order flow
- [ ] Restaurant modifiers/toppings/sizes later
- [ ] Multiple Storefront themes
- [ ] Product Reviews
- [ ] Automated billing/subscriptions
- [ ] Advanced Super Admin analytics
- [ ] Product facets/filter attributes

And yes, **Quantity should be next**.

Before changing Prisma, I’d first have the coding agent investigate the existing `Product`, `Order`, `OrderItem`, Admin Product form/API, Storefront cart, and order-creation transaction. Stock deduction especially needs to happen on the backend, not be trusted to the Storefront.
Yes. I’d make **Product Quantity / Stock** the next concrete Release 1 task and place it under Retail stabilization.

## Release 1 TODO — Locked Priority

- [ ] **1. Stabilize existing Retail core**

    - [ ] **Product quantity / stock — NEXT**

        - [x] Add quantity to Product creation
        - [x] Add quantity to Product edit
        - [x] Persist quantity in Admin/API + Prisma
        - [x] Show available quantity appropriately in Storefront
        - [x] Prevent adding more than available stock to cart
        - [x] Validate quantity again when placing the order
        - [x] Reduce stock when Admin confirms an order
        - [x] Restore stock when Admin cancels a confirmed order
        - [x] Handle `0` quantity / out-of-stock UI
        - [x] Decide behavior if cart contains an item whose stock changed before checkout
        - [x] Preserve historical OrderItem data even when Product quantity later changes

    - [ ] Verify Store creation flow
    - [ ] Verify Products / Categories
    - [ ] Verify cart / checkout
    - [ ] Verify order creation
    - [ ] Verify merchant new-order email
    - [ ] Verify Admin order management
    - [ ] Fix only genuine blockers/regressions

- [ ] **2. Minimal Super Admin Portal**

    - [ ] Create third frontend repo
    - [ ] Reuse existing Admin/API backend
    - [ ] Super Admin authentication/authorization
    - [ ] Store listing
    - [ ] Store detail
    - [ ] Store owner information
    - [ ] Order metrics
    - [ ] Sales metrics
    - [ ] Billing plan assignment/change
    - [ ] Monthly invoice generation
    - [ ] Send / mark invoice
    - [ ] Invoice history
    - [ ] Keep billing manual for Release 1

- [ ] **3. Mobile-friendly Merchant Admin**

    - [ ] Responsive navigation
    - [ ] Orders
    - [ ] Products
    - [ ] Categories
    - [ ] Store settings
    - [ ] Tables/cards/actions
    - [ ] Mobile/tablet usability

- [ ] **4. Storefront visual redesign**

    - [ ] Homepage
    - [ ] Navigation
    - [ ] Product listing
    - [ ] Category pages
    - [ ] Product detail
    - [ ] Cart
    - [ ] Checkout
    - [ ] Order confirmation
    - [ ] Mobile-first polish

- [ ] **5. Theme-ready Storefront architecture**

    - [ ] Separate branding/configuration from layout
    - [ ] Theme configuration boundary
    - [ ] Logo
    - [ ] Brand colors
    - [ ] Necessary appearance settings
    - [ ] Ship **one polished default theme**
    - [ ] Do not build multiple selectable themes yet

- [ ] **6. Production Release**

    - [ ] Production environment configuration
    - [ ] Prisma migration verification
    - [ ] Production database/data-safety checks
    - [ ] Clerk configuration
    - [ ] Resend configuration
    - [ ] Cloudinary configuration
    - [ ] Deploy Admin/API
    - [ ] Deploy Storefront
    - [ ] Deploy Super Admin
    - [ ] End-to-end manual testing
    - [ ] Test fresh Store creation
    - [ ] Test merchant onboarding
    - [ ] Release

### Post-Release

- [ ] Restaurant business type
- [ ] Restaurant-specific Storefront/Menu UI
- [ ] Restaurant guest-order flow
- [ ] Restaurant modifiers/toppings/sizes later
- [ ] Multiple Storefront themes
- [ ] Product Reviews
- [ ] Automated billing/subscriptions
- [ ] Advanced Super Admin analytics
- [ ] Product facets/filter attributes


## Release 1 Platform Billing — Canonical Implementation Checklist

Single cross-repo source of truth for platform billing. Implement sequentially, module by module. Only check an item once implemented AND verified — not on attempt.

Labels: **Admin/API** = ecommerce-admin-cwa backend/API. **Super Admin UI** = ecommerce-super-admin frontend. Both listed where a task spans repos.

- [ ] **1. Billing Domain / Prisma Design** — Admin/API
    - [x] `BillingPlan` model
    - [x] Store → current Billing Plan relationship
    - [x] FIXED plan fields
    - [x] PERCENTAGE plan fields
    - [x] PKR-only Release 1 behavior
    - [x] Order confirmation timestamp field required for billing attribution
    - [x] Invoice model
    - [x] Immutable invoice calculation/plan snapshot fields
    - [x] Payment model
    - [x] Payment evidence attachment model
    - [x] Email delivery state fields
    - [ ] Financial ledger/transaction model (or agreed representation)
    - [x] Indexes / unique constraints
    - [x] Store + Billing Month uniqueness constraint
    - [x] Decimal/money handling strategy
    - [x] Migrations

- [ ] **2. Billing Plans** — Admin/API
    - [ ] Billing Plan CRUD API
    - [ ] FIXED plan validation
    - [ ] PERCENTAGE plan validation
    - [ ] Store Billing Plan assignment endpoint
    - [ ] Enforce one current plan per Store
    - [ ] Changing current plan
    - [ ] No plan-assignment history/effective dating for Release 1
    - [ ] Privileged Super Admin authorization
    - [ ] API response contracts
    - [ ] Validation/error handling

- [ ] **3. Billing Plans** — Super Admin UI
    - [ ] Billing Plans listing
    - [ ] Create plan
    - [ ] Edit plan
    - [ ] Plan type FIXED/PERCENTAGE forms
    - [ ] Assign/change Store Billing Plan
    - [ ] Current plan visibility on Store Detail
    - [ ] Loading/error/empty states
    - [ ] Responsive/manual verification

- [ ] **4. Order Confirmation Timestamp** — Admin/API
    - [ ] Add reliable confirmation timestamp to Order/domain
    - [ ] `DRAFT -> CONFIRMED` sets confirmation timestamp
    - [ ] `CANCELED -> CONFIRMED` sets a NEW/latest confirmation timestamp
    - [ ] Latest confirmation date is authoritative for billing month
    - [ ] Cancellation does not invent billing revenue
    - [ ] Preserve existing stock transition/concurrency behavior
    - [ ] Migration/backfill strategy for legacy orders
    - [ ] Tests/manual verification
    - Locked rule: order confirmed in August, canceled, re-confirmed in September → billing month = September (latest confirmation).

- [ ] **5. Eligible Monthly Sales Calculation** — Admin/API
    - [ ] Store + billing month input
    - [ ] Only completed past months are billable
    - [ ] Current month rejected
    - [ ] Confirmation timestamp determines month
    - [ ] CONFIRMED + DELIVERED eligible
    - [ ] DRAFT + CANCELED excluded
    - [ ] `isPaid` ignored
    - [ ] Use immutable `Order.total`
    - [ ] Legacy fallback policy where required
    - [ ] Decimal arithmetic
    - [ ] PKR behavior
    - [ ] Calculation API/service
    - [ ] Tests/manual verification

- [ ] **6. Invoice Preview / Calculation** — Admin/API + Super Admin UI
    - [ ] Percentage: `eligibleSales × percentage = basePlatformFee` (Admin/API)
    - [ ] Fixed: `fixedAmount = basePlatformFee` (Admin/API)
    - [ ] `basePlatformFee + additionalCharge - discount = invoiceTotal` (Admin/API)
    - [ ] Additional Charge optional (Admin/API)
    - [ ] Discount optional (Admin/API)
    - [ ] Notes optional (Admin/API)
    - [ ] Discount may reduce invoice to PKR 0 (Admin/API)
    - [ ] Invoice total must never become negative (Admin/API)
    - [ ] Enforce discount <= basePlatformFee + additionalCharge (Admin/API)
    - [ ] Preview does not create an invoice (Admin/API)
    - [ ] Preview UI exposes the calculation clearly to Super Admin (Super Admin UI)

- [ ] **7. Permanent Invoice Generation** — Admin/API
    - [ ] Generate & Send action
    - [ ] No Draft invoice lifecycle
    - [ ] Completed past billing month only
    - [ ] Maximum one invoice per Store + Billing Month
    - [ ] Enforce uniqueness at database level
    - [ ] `invoiceDate` = creation date
    - [ ] `dueDate` = creation date
    - [ ] Snapshot: Billing Plan id/name/type
    - [ ] Snapshot: percentage/fixed amount
    - [ ] Snapshot: eligible sales
    - [ ] Snapshot: base platform fee
    - [ ] Snapshot: additional charge
    - [ ] Snapshot: discount
    - [ ] Snapshot: final total
    - [ ] Snapshot: notes
    - [ ] Snapshot: billing month
    - [ ] Immutable financial content after creation
    - [ ] Payment status rule: total > PKR 0 → `PENDING`
    - [ ] Payment status rule: total = PKR 0 → automatically `PAID`
    - [ ] Edge case: zero base fee + Additional Charge > 0 → `PENDING`, not auto-paid

- [ ] **8. Invoice PDF** — Admin/API
    - [ ] Invoice PDF template
    - [ ] Store billing/profile information
    - [ ] Invoice number/reference
    - [ ] Billing month
    - [ ] Calculation breakdown
    - [ ] Final amount
    - [ ] Invoice/due dates
    - [ ] Payment status as appropriate
    - [ ] Persistent/reproducible PDF strategy
    - [ ] Manual PDF verification

- [ ] **9. Invoice Email Delivery** — Admin/API
    - [ ] Generated invoice remains valid even if email fails
    - [ ] Separate email delivery status (independent of invoice creation)
    - [ ] SENT / FAILED states (or agreed equivalent)
    - [ ] Email timestamps/attempt information as appropriate
    - [ ] Initial send after invoice creation
    - [ ] Resend Email action
    - [ ] Retry does NOT create a new invoice
    - [ ] Retry does NOT alter financial invoice data
    - [ ] Super Admin can see email delivery status
    - [ ] Safe error handling
    - [ ] Do not couple invoice DB creation rollback to email delivery failure
    - [ ] Manual verification

- [ ] **10. Invoices** — Super Admin UI
    - [ ] Top-level Invoices page
    - [ ] Invoice listing (status, email delivery status, Store, billing month, invoice date, total)
    - [ ] Invoice detail
    - [ ] PDF access
    - [ ] Resend Email
    - [ ] Store Detail -> Invoices
    - [ ] Invoice creation flow: Store selection
    - [ ] Invoice creation flow: completed billing month selection
    - [ ] Invoice creation flow: calculation preview
    - [ ] Invoice creation flow: Additional Charge
    - [ ] Invoice creation flow: Discount
    - [ ] Invoice creation flow: Notes
    - [ ] Invoice creation flow: Generate & Send
    - [ ] Loading/error/empty states
    - [ ] Responsive/manual verification
    - Note: no merchant-facing platform invoice UI for Release 1.

- [ ] **11. Manual Payment Recording** — Admin/API + Super Admin UI
    - [ ] Mark as Paid action (Admin/API + Super Admin UI)
    - [ ] Only unpaid/non-zero invoices need manual payment (Admin/API)
    - [ ] Full payment only, no partial/installment payments (Admin/API)
    - [ ] Payment amount read-only, equal to invoice total (Admin/API)
    - [ ] Payment date (Admin/API + Super Admin UI)
    - [ ] Notes optional (Admin/API + Super Admin UI)
    - [ ] Evidence attachment(s) optional (Admin/API + Super Admin UI)
    - [ ] Attachment validation/storage design (Admin/API)
    - [ ] Create permanent Payment record (Admin/API)
    - [ ] Transition PENDING -> PAID (Admin/API)
    - [ ] Prevent duplicate payment recording (Admin/API)
    - [ ] Invoice payment history/detail (Super Admin UI)
    - [ ] Manual verification
    - Note: PKR 0 invoices must not require manual payment — already PAID.

- [ ] **12. Store Financial Ledger / Transactions** — Admin/API + Super Admin UI
    - [ ] Invoice generated = DEBIT (Admin/API)
    - [ ] Payment recorded = CREDIT (Admin/API)
    - [ ] Store-level transaction history (Admin/API)
    - [ ] Transaction references (Admin/API)
    - [ ] Running balance (Admin/API)
    - [ ] Total Debit / Total Credit (Admin/API)
    - [ ] Outstanding Balance = Total Debit - Total Credit (Admin/API)
    - [ ] Store Detail -> Transactions (Super Admin UI)
    - [ ] Distinguish this accounting ledger from customer Order History (Super Admin UI)
    - [ ] Sorting/pagination if required (Admin/API + Super Admin UI)
    - [ ] Decimal correctness (Admin/API)
    - [ ] Manual verification

- [ ] **13. Final Billing Verification** — Admin/API + Super Admin UI
    - [ ] Prisma migration verified
    - [ ] API auth 401/403/200 behavior
    - [ ] FIXED plan end-to-end
    - [ ] PERCENTAGE plan end-to-end
    - [ ] Latest confirmation date behavior
    - [ ] Zero-sales percentage invoice
    - [ ] PKR 0 invoice auto-paid
    - [ ] Additional charge turns otherwise-zero invoice into PENDING
    - [ ] Discount cannot make total negative
    - [ ] Duplicate Store+month invoice prevented
    - [ ] Invoice remains immutable after Store plan changes
    - [ ] Email success
    - [ ] Email failure preserves invoice
    - [ ] Resend Email works without duplicate invoice
    - [ ] Manual Mark as Paid
    - [ ] Payment evidence
    - [ ] Debit/credit ledger
    - [ ] Store outstanding balance
    - [ ] Direct refresh/error states
    - [ ] Responsive UI
    - [ ] Lint/typecheck/build in affected repos
