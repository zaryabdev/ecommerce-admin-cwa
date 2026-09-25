import { Prisma } from "@prisma/client";

import {
  InvoiceCalculationError,
  calculateInvoicePreview,
  type InvoiceCalculation,
  type InvoiceCalculationInput,
} from "@/lib/invoice-calculation";
import { generateInvoiceNumber } from "@/lib/invoice-number";
import prismadb from "@/lib/prismadb";

// Permanent Invoice generation. All financial values come from
// calculateInvoicePreview, recalculated from authoritative database state
// inside the generating transaction; nothing a client previewed is trusted, and
// the client only supplies generation inputs (month, adjustments, notes).
// Persistence here is a pure snapshot of that calculation. No PDF, email or
// Payment is created: email delivery must never be able to roll back an
// already-created Invoice.

const MAX_ATTEMPTS = 3;

export interface GenerateInvoiceOptions {
  db?: typeof prismadb;
  /** Numbering policy; replaceable without touching calculation/persistence. */
  invoiceNumberGenerator?: (year: number, month: number) => string;
}

type UniqueTarget = "store_month" | "invoice_number" | "unknown";

// Which unique constraint fired, from Prisma's P2002 metadata (a list of
// fields, or a constraint name string depending on the driver path).
function classifyUniqueViolation(error: Prisma.PrismaClientKnownRequestError): UniqueTarget {
  const target = String(error.meta?.target ?? "");
  if (target.includes("invoiceNumber")) return "invoice_number";
  if (target.includes("billingMonth")) return "store_month";
  return "unknown";
}

const persist = (
  tx: Prisma.TransactionClient,
  calc: InvoiceCalculation,
  invoiceNumber: string,
  generatedAt: Date
) =>
  tx.invoice.create({
    data: {
      invoiceNumber,
      storeId: calc.store.id,
      billingMonthYear: calc.billingMonthYear,
      billingMonthMonth: calc.billingMonthMonth,

      // Immutable plan snapshot (the live BillingPlan is reference only).
      billingPlanId: calc.billingPlan.id,
      billingPlanName: calc.billingPlan.name,
      billingPlanType: calc.billingPlan.type,
      fixedAmount: calc.billingPlan.fixedAmount?.toFixed() ?? null,
      percentageRate: calc.billingPlan.percentageRate?.toFixed() ?? null,

      eligibleSales: calc.eligibleSales.toFixed(),
      basePlatformFee: calc.basePlatformFee.toFixed(),
      additionalCharge: calc.additionalCharge.toFixed(),
      discount: calc.discount.toFixed(),
      total: calc.total.toFixed(),
      currency: calc.currency,
      notes: calc.notes,

      // One timestamp for the whole generation event; no payment terms.
      invoiceDate: generatedAt,
      dueDate: generatedAt,

      // Zero-value invoices are still created, and are already settled.
      paymentStatus: calc.paymentStatus,

      // Nothing has been sent.
      emailStatus: "NOT_SENT",
      emailSentAt: null,
      lastEmailAttemptAt: null,
      emailError: null,
      emailAttemptCount: 0,
    },
  });

export type GeneratedInvoice = Awaited<ReturnType<typeof persist>>;

export async function generateInvoice(
  input: InvoiceCalculationInput,
  {
    db = prismadb,
    invoiceNumberGenerator = generateInvoiceNumber,
  }: GenerateInvoiceOptions = {}
): Promise<GeneratedInvoice> {
  for (let attempt = 1; ; attempt++) {
    const generatedAt = new Date();
    try {
      // REPEATABLE READ: the multi-read calculation sees one snapshot. The
      // Store+month unique constraint, not this check, prevents duplicates.
      return await db.$transaction(
        async (tx) => {
          const calc = await calculateInvoicePreview(input, {
            db: tx,
            now: generatedAt,
          });
          const invoiceNumber = invoiceNumberGenerator(
            calc.billingMonthYear,
            calc.billingMonthMonth
          );
          return persist(tx, calc, invoiceNumber, generatedAt);
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
          maxWait: 10_000,
          timeout: 20_000,
        }
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          const target = classifyUniqueViolation(error);
          if (target === "store_month") {
            // Lost the race (or it already existed): safe conflict, no retry.
            throw new InvoiceCalculationError(
              "INVOICE_ALREADY_EXISTS",
              "An invoice already exists for this store and billing month."
            );
          }
          // Invoice-number collision: the aborted transaction is retried whole
          // (a failed statement poisons a Postgres transaction) with a new number.
          if (target === "invoice_number" && attempt < MAX_ATTEMPTS) continue;
        }
        // Serialization failure under REPEATABLE READ: retry; the early
        // existing-invoice check then reports the conflict cleanly.
        if (error.code === "P2034" && attempt < MAX_ATTEMPTS) continue;
      }
      throw error;
    }
  }
}

/** JSON-safe Invoice: Decimals as strings, dates as ISO strings. */
export function serializeInvoice(invoice: GeneratedInvoice) {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    storeId: invoice.storeId,
    billingMonthYear: invoice.billingMonthYear,
    billingMonthMonth: invoice.billingMonthMonth,
    invoiceDate: invoice.invoiceDate.toISOString(),
    dueDate: invoice.dueDate.toISOString(),
    billingPlanId: invoice.billingPlanId,
    billingPlanName: invoice.billingPlanName,
    billingPlanType: invoice.billingPlanType,
    fixedAmount: invoice.fixedAmount?.toFixed() ?? null,
    percentageRate: invoice.percentageRate?.toFixed() ?? null,
    eligibleSales: invoice.eligibleSales.toFixed(),
    basePlatformFee: invoice.basePlatformFee.toFixed(),
    additionalCharge: invoice.additionalCharge.toFixed(),
    discount: invoice.discount.toFixed(),
    total: invoice.total.toFixed(),
    currency: invoice.currency,
    notes: invoice.notes,
    paymentStatus: invoice.paymentStatus,
    emailStatus: invoice.emailStatus,
    createdAt: invoice.createdAt.toISOString(),
    updatedAt: invoice.updatedAt.toISOString(),
  };
}
