import { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

import { PreciseDecimal } from "@/lib/decimal";
import prismadb from "@/lib/prismadb";

// Eligible monthly sales for platform billing: a Store/period domain value.
// It is a plain sum. It does not depend on the Store's Billing Plan and does
// not calculate any fee, so FIXED, PERCENTAGE, archived and missing plans all
// get the same answer.
//
// The period is an explicit half-open instant range [periodStart, periodEnd).
// What "September 2026" means in timezone terms is NOT decided here (no
// billing timezone policy exists yet); callers convert a billing month into
// exact boundaries once that policy is locked.

// Same semantics as Super Admin salesTotal: accepted orders only.
export const ELIGIBLE_SALES_STATUSES = ["CONFIRMED", "DELIVERED"] as const;

// Platform billing is PKR-only. Orders with a null currency are legacy rows,
// which the existing salesTotal policy also treats as PKR.
export const ELIGIBLE_SALES_CURRENCY = "PKR";

export type EligibleSalesErrorCode =
  | "INVALID_PERIOD"
  | "STORE_NOT_FOUND"
  | "UNSUPPORTED_CURRENCY";

export class EligibleSalesError extends Error {
  code: EligibleSalesErrorCode;
  constructor(code: EligibleSalesErrorCode, message: string) {
    super(message);
    this.name = "EligibleSalesError";
    this.code = code;
  }
}

export interface EligibleSalesInput {
  storeId: string;
  /** Inclusive instant. */
  periodStart: Date;
  /** Exclusive instant. */
  periodEnd: Date;
}

export interface EligibleSalesResult {
  storeId: string;
  periodStart: Date;
  periodEnd: Date;
  /** Exact Decimal sum; use .toFixed() at API boundaries. No rounding applied. */
  eligibleSales: Decimal;
  /** Number of eligible Orders (not OrderItems). */
  eligibleOrderCount: number;
  currency: typeof ELIGIBLE_SALES_CURRENCY;
}

type Db = Prisma.TransactionClient | typeof prismadb;

const isValidDate = (value: unknown): value is Date =>
  value instanceof Date && !Number.isNaN(value.getTime());

export async function calculateEligibleSales(
  { storeId, periodStart, periodEnd }: EligibleSalesInput,
  db: Db = prismadb
): Promise<EligibleSalesResult> {
  if (!isValidDate(periodStart) || !isValidDate(periodEnd)) {
    throw new EligibleSalesError(
      "INVALID_PERIOD",
      "periodStart and periodEnd must be valid dates."
    );
  }
  if (periodStart.getTime() >= periodEnd.getTime()) {
    throw new EligibleSalesError(
      "INVALID_PERIOD",
      "periodStart must be before periodEnd."
    );
  }

  // The whole eligibility rule lives in this DB predicate:
  //  - Store scope
  //  - accepted statuses only (a CANCELED order keeps its old confirmedAt, so
  //    the status check is what excludes it)
  //  - confirmedAt in [periodStart, periodEnd). Never createdAt; legacy NULL
  //    confirmedAt (billing month unknown) never matches. `not: null` is
  //    explicit even though the range comparison already excludes NULL.
  //  - isPaid is deliberately absent.
  const eligible = {
    storeId,
    status: { in: [...ELIGIBLE_SALES_STATUSES] },
    confirmedAt: { not: null, gte: periodStart, lt: periodEnd },
  } satisfies Prisma.OrderWhereInput;

  // Three independent reads, no per-order queries:
  //  1. Store existence, so "unknown Store" is distinguishable from "no sales".
  //  2. Snapshot orders (total IS NOT NULL): aggregated in the DB by currency.
  //     Stored Order.total always wins; live Product prices are never used.
  //  3. Legacy orders (total IS NULL): fetched with items in one query for the
  //     established Product.price x quantity fallback.
  const [store, snapshotGroups, legacyOrders] = await Promise.all([
    db.store.findUnique({ where: { id: storeId }, select: { id: true } }),
    db.order.groupBy({
      by: ["currency"],
      where: { ...eligible, total: { not: null } },
      _sum: { total: true },
      _count: { _all: true },
    }),
    db.order.findMany({
      where: { ...eligible, total: null },
      select: {
        currency: true,
        orderItems: {
          select: { quantity: true, product: { select: { price: true } } },
        },
      },
    }),
  ]);

  if (!store) {
    throw new EligibleSalesError("STORE_NOT_FOUND", "Store not found.");
  }

  let eligibleSales: Decimal = new PreciseDecimal(0);
  let eligibleOrderCount = 0;
  const currencies = new Set<string>();

  for (const group of snapshotGroups) {
    currencies.add(group.currency ?? ELIGIBLE_SALES_CURRENCY);
    eligibleSales = eligibleSales.plus(new PreciseDecimal(group._sum.total ?? 0));
    eligibleOrderCount += group._count._all;
  }

  // Legacy fallback (total IS NULL only), in Decimal arithmetic.
  for (const order of legacyOrders) {
    currencies.add(order.currency ?? ELIGIBLE_SALES_CURRENCY);
    eligibleSales = order.orderItems.reduce(
      (sum, item) =>
        sum.plus(new PreciseDecimal(item.product.price).times(item.quantity)),
      eligibleSales
    );
    eligibleOrderCount += 1;
  }

  // Never silently sum (or relabel) other currencies; no FX in Release 1.
  const unsupported = Array.from(currencies).filter(
    (code) => code !== ELIGIBLE_SALES_CURRENCY
  );
  if (unsupported.length > 0) {
    throw new EligibleSalesError(
      "UNSUPPORTED_CURRENCY",
      `Eligible sales require ${ELIGIBLE_SALES_CURRENCY} orders; found ${unsupported.join(", ")}.`
    );
  }

  return {
    storeId,
    periodStart,
    periodEnd,
    eligibleSales,
    eligibleOrderCount,
    currency: ELIGIBLE_SALES_CURRENCY,
  };
}
