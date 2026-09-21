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
- [ ] **2. Immutable Order Monetary Snapshots**
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
