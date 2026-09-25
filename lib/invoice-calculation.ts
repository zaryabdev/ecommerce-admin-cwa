import { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

import { ValidationError, parseDecimal } from "@/lib/billing-plan";
import { PreciseDecimal, roundMoney } from "@/lib/decimal";
import {
  ELIGIBLE_SALES_CURRENCY,
  EligibleSalesError,
  calculateEligibleSales,
} from "@/lib/eligible-sales";
import prismadb from "@/lib/prismadb";

// Invoice calculation for a Store + billing month, using the Store's CURRENT
// Billing Plan. It only calculates: it never creates an Invoice, Payment or
// any other row, so the future permanent-generation task can call the same
// function (inside its own transaction) instead of re-implementing formulas.
// A preview is informative, not a reservation.

export type InvoiceCalculationErrorCode =
  | "INVALID_BILLING_MONTH"
  | "BILLING_MONTH_NOT_COMPLETE"
  | "INVALID_DECIMAL"
  | "NEGATIVE_ADDITIONAL_CHARGE"
  | "NEGATIVE_DISCOUNT"
  | "INVALID_NOTES"
  | "STORE_NOT_FOUND"
  | "INVOICE_ALREADY_EXISTS"
  | "NO_BILLING_PLAN"
  | "INVALID_BILLING_PLAN"
  | "UNSUPPORTED_CURRENCY"
  | "DISCOUNT_EXCEEDS_AMOUNT";

// Suggested HTTP mapping for routes (400 input, 404 missing Store, 409 state).
export const INVOICE_CALCULATION_ERROR_STATUS: Record<
  InvoiceCalculationErrorCode,
  number
> = {
  INVALID_BILLING_MONTH: 400,
  BILLING_MONTH_NOT_COMPLETE: 400,
  INVALID_DECIMAL: 400,
  NEGATIVE_ADDITIONAL_CHARGE: 400,
  NEGATIVE_DISCOUNT: 400,
  INVALID_NOTES: 400,
  DISCOUNT_EXCEEDS_AMOUNT: 400,
  STORE_NOT_FOUND: 404,
  INVOICE_ALREADY_EXISTS: 409,
  NO_BILLING_PLAN: 409,
  INVALID_BILLING_PLAN: 409,
  UNSUPPORTED_CURRENCY: 409,
};

export class InvoiceCalculationError extends Error {
  code: InvoiceCalculationErrorCode;
  constructor(code: InvoiceCalculationErrorCode, message: string) {
    super(message);
    this.name = "InvoiceCalculationError";
    this.code = code;
  }
}

const MONEY_SCALE = 2;

// Years below 2000 are rejected (also avoids Date.UTC's 0-99 -> 19xx quirk).
const MIN_BILLING_YEAR = 2000;
const MAX_BILLING_YEAR = 9999;
// No limit exists in the schema (Postgres text); this is only a sanity bound.
const MAX_NOTES_LENGTH = 5000;

/**
 * UTC calendar boundaries of a billing month, half-open [start, end).
 * Date.UTC rolls month 12 over into January of the next year.
 */
export function getBillingMonthPeriod(year: unknown, month: unknown) {
  if (
    typeof year !== "number" ||
    !Number.isInteger(year) ||
    year < MIN_BILLING_YEAR ||
    year > MAX_BILLING_YEAR ||
    typeof month !== "number" ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    throw new InvoiceCalculationError(
      "INVALID_BILLING_MONTH",
      `billingMonthYear must be an integer between ${MIN_BILLING_YEAR} and ${MAX_BILLING_YEAR} and billingMonthMonth an integer from 1 to 12.`
    );
  }
  return {
    year,
    month,
    periodStart: new Date(Date.UTC(year, month - 1, 1)),
    periodEnd: new Date(Date.UTC(year, month, 1)),
  };
}

// Manual invoices are for completed past months only: the month must have
// ended (UTC) by `now`, so the current and future months are rejected.
const assertMonthComplete = (periodEnd: Date, now: Date) => {
  if (periodEnd.getTime() > now.getTime()) {
    throw new InvoiceCalculationError(
      "BILLING_MONTH_NOT_COMPLETE",
      "Invoices can only be previewed for completed past months (UTC)."
    );
  }
};

// Optional non-negative Decimal input, default 0, normalized to money
// precision (2 dp, ROUND_HALF_UP). Reuses the Billing Plan
// decimal parser (plain decimal string/number, precision-checked) and remaps
// its error codes to invoice-specific ones.
function parseAdjustment(
  field: "additionalCharge" | "discount",
  value: unknown
): Decimal {
  if (value === undefined || value === null) return new PreciseDecimal(0);
  try {
    return roundMoney(parseDecimal(field, value));
  } catch (error) {
    if (error instanceof ValidationError) {
      if (error.code === "NEGATIVE_VALUE") {
        throw new InvoiceCalculationError(
          field === "discount" ? "NEGATIVE_DISCOUNT" : "NEGATIVE_ADDITIONAL_CHARGE",
          error.message
        );
      }
      throw new InvoiceCalculationError("INVALID_DECIMAL", error.message);
    }
    throw error;
  }
}

function parseNotes(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new InvoiceCalculationError("INVALID_NOTES", "notes must be a string.");
  }
  const notes = value.trim();
  if (notes.length > MAX_NOTES_LENGTH) {
    throw new InvoiceCalculationError(
      "INVALID_NOTES",
      `notes must be at most ${MAX_NOTES_LENGTH} characters.`
    );
  }
  return notes === "" ? null : notes;
}

type PlanRow = {
  id: string;
  name: string;
  type: "FIXED" | "PERCENTAGE";
  fixedAmount: Decimal | null;
  percentageRate: Decimal | null;
  isArchived: boolean;
};

// Older plans may predate the locked rules, so validate defensively. Stored
// data is never repaired or modified here.
function assertPlanUsable(plan: PlanRow) {
  const invalid = (message: string) =>
    new InvoiceCalculationError("INVALID_BILLING_PLAN", message);

  if (plan.type === "FIXED") {
    if (plan.fixedAmount === null) throw invalid("The assigned FIXED plan has no fixedAmount.");
    if (plan.fixedAmount.isNegative()) throw invalid("The assigned FIXED plan has a negative fixedAmount.");
    if (plan.percentageRate !== null) throw invalid("The assigned FIXED plan also has a percentageRate.");
  } else if (plan.type === "PERCENTAGE") {
    const rate = plan.percentageRate;
    if (rate === null) throw invalid("The assigned PERCENTAGE plan has no percentageRate.");
    if (rate.isNegative() || rate.greaterThan(100)) {
      throw invalid("The assigned PERCENTAGE plan's percentageRate must be between 0 and 100.");
    }
    if (plan.fixedAmount !== null) throw invalid("The assigned PERCENTAGE plan also has a fixedAmount.");
  } else {
    throw invalid("The assigned plan has an unknown type.");
  }
}

export interface InvoiceCalculationInput {
  storeId: string;
  // Raw request values: validated here so every caller gets the same rules.
  billingMonthYear: unknown;
  billingMonthMonth: unknown;
  additionalCharge?: unknown;
  discount?: unknown;
  notes?: unknown;
}

export interface InvoiceCalculationOptions {
  db?: Prisma.TransactionClient | typeof prismadb;
  /** Clock for the past-month rule; injectable for tests. */
  now?: Date;
}

/** Decimal-valued result, shaped like the future Invoice snapshot. */
export interface InvoiceCalculation {
  store: { id: string; name: string };
  billingMonthYear: number;
  billingMonthMonth: number;
  periodStart: Date;
  periodEnd: Date;
  billingPlan: {
    id: string;
    name: string;
    type: "FIXED" | "PERCENTAGE";
    fixedAmount: Decimal | null;
    percentageRate: Decimal | null;
    isArchived: boolean;
  };
  eligibleSales: Decimal;
  eligibleOrderCount: number;
  basePlatformFee: Decimal;
  additionalCharge: Decimal;
  discount: Decimal;
  total: Decimal;
  currency: typeof ELIGIBLE_SALES_CURRENCY;
  notes: string | null;
  paymentStatus: "PENDING" | "PAID";
}

export async function calculateInvoicePreview(
  input: InvoiceCalculationInput,
  { db = prismadb, now = new Date() }: InvoiceCalculationOptions = {}
): Promise<InvoiceCalculation> {
  // 1. Pure input validation first (no DB access for bad requests).
  const { year, month, periodStart, periodEnd } = getBillingMonthPeriod(
    input.billingMonthYear,
    input.billingMonthMonth
  );
  assertMonthComplete(periodEnd, now);
  const additionalCharge = parseAdjustment("additionalCharge", input.additionalCharge);
  const discount = parseAdjustment("discount", input.discount);
  const notes = parseNotes(input.notes);

  // 2. Store + its CURRENT plan (an archived plan that is still assigned is a
  //    real assignment and is used; no assignment history exists).
  const store = await db.store.findUnique({
    where: { id: input.storeId },
    select: {
      id: true,
      name: true,
      billingPlan: {
        select: {
          id: true,
          name: true,
          type: true,
          fixedAmount: true,
          percentageRate: true,
          isArchived: true,
        },
      },
    },
  });
  if (!store) {
    throw new InvoiceCalculationError("STORE_NOT_FOUND", "Store not found.");
  }

  // 3. One invoice per Store + month (also a DB unique constraint).
  const existing = await db.invoice.findUnique({
    where: {
      storeId_billingMonthYear_billingMonthMonth: {
        storeId: store.id,
        billingMonthYear: year,
        billingMonthMonth: month,
      },
    },
    select: { id: true },
  });
  if (existing) {
    throw new InvoiceCalculationError(
      "INVOICE_ALREADY_EXISTS",
      "An invoice already exists for this store and billing month."
    );
  }

  const plan = store.billingPlan;
  if (!plan) {
    throw new InvoiceCalculationError(
      "NO_BILLING_PLAN",
      "This store has no billing plan assigned."
    );
  }
  assertPlanUsable(plan);

  // 4. Eligible sales: all Order eligibility rules live in that service.
  let sales;
  try {
    sales = await calculateEligibleSales(
      { storeId: store.id, periodStart, periodEnd },
      db
    );
  } catch (error) {
    if (error instanceof EligibleSalesError) {
      if (error.code === "UNSUPPORTED_CURRENCY") {
        throw new InvoiceCalculationError("UNSUPPORTED_CURRENCY", error.message);
      }
      if (error.code === "STORE_NOT_FOUND") {
        throw new InvoiceCalculationError("STORE_NOT_FOUND", error.message);
      }
    }
    throw error;
  }

  // 5. Fee. Decimal only. percentageRate is in percentage points (5 = 5%), so
  //    it is divided by 100 and never scaled otherwise. The raw result keeps
  //    full precision and is then normalized to money precision (2 dp,
  //    ROUND_HALF_UP), exactly what a generated Invoice persists. Eligible
  //    sales are NOT rounded: they are calculation evidence.
  const rawPlatformFee =
    plan.type === "FIXED"
      ? new PreciseDecimal(plan.fixedAmount as Decimal)
      : sales.eligibleSales
          .times(new PreciseDecimal(plan.percentageRate as Decimal))
          .div(100);
  const basePlatformFee = roundMoney(rawPlatformFee);

  // 6. Adjustments and floor, on the normalized values: the total can never be
  //    negative, and a discount is rejected rather than clamped.
  const subtotalBeforeDiscount = basePlatformFee.plus(additionalCharge);
  if (discount.greaterThan(subtotalBeforeDiscount)) {
    throw new InvoiceCalculationError(
      "DISCOUNT_EXCEEDS_AMOUNT",
      "discount must not exceed the platform fee plus additional charge."
    );
  }
  const total = subtotalBeforeDiscount.minus(discount);

  // Invariant persisted on every Invoice: fee + charge - discount = total,
  // exactly, at money precision.
  if (
    total.decimalPlaces() > MONEY_SCALE ||
    !total.equals(basePlatformFee.plus(additionalCharge).minus(discount))
  ) {
    throw new Error("Invoice total invariant violated");
  }

  return {
    store: { id: store.id, name: store.name },
    billingMonthYear: year,
    billingMonthMonth: month,
    periodStart,
    periodEnd,
    billingPlan: {
      id: plan.id,
      name: plan.name,
      type: plan.type,
      fixedAmount: plan.fixedAmount,
      percentageRate: plan.percentageRate,
      isArchived: plan.isArchived,
    },
    eligibleSales: sales.eligibleSales,
    eligibleOrderCount: sales.eligibleOrderCount,
    basePlatformFee,
    additionalCharge,
    discount,
    total,
    currency: sales.currency,
    notes,
    // A zero total needs no payment; nothing is created either way.
    paymentStatus: total.isZero() ? "PAID" : "PENDING",
  };
}

/** JSON-safe form: Decimals become plain decimal strings, dates ISO strings. */
export function serializeInvoicePreview(calc: InvoiceCalculation) {
  const str = (value: Decimal | null) => (value === null ? null : value.toFixed());
  return {
    store: calc.store,
    billingMonthYear: calc.billingMonthYear,
    billingMonthMonth: calc.billingMonthMonth,
    periodStart: calc.periodStart.toISOString(),
    periodEnd: calc.periodEnd.toISOString(),
    billingPlan: {
      ...calc.billingPlan,
      fixedAmount: str(calc.billingPlan.fixedAmount),
      percentageRate: str(calc.billingPlan.percentageRate),
    },
    eligibleSales: calc.eligibleSales.toFixed(),
    eligibleOrderCount: calc.eligibleOrderCount,
    basePlatformFee: calc.basePlatformFee.toFixed(),
    additionalCharge: calc.additionalCharge.toFixed(),
    discount: calc.discount.toFixed(),
    total: calc.total.toFixed(),
    currency: calc.currency,
    notes: calc.notes,
    paymentStatus: calc.paymentStatus,
  };
}
