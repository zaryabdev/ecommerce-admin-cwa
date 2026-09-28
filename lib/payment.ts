import { Prisma } from "@prisma/client";

import { InvoiceNotFoundError } from "@/lib/invoice-pdf";
import prismadb from "@/lib/prismadb";

// Manual payment recording (Release 1: full payment only, exactly one Payment
// per Invoice). The Payment amount is always the stored Invoice total — never
// a client-supplied value — and both writes happen in one transaction so an
// Invoice can never end up PAID without a matching Payment, or vice versa.

export type MarkPaidErrorCode = "INVOICE_ZERO_TOTAL" | "INVOICE_ALREADY_PAID";

export const MARK_PAID_ERROR_STATUS: Record<MarkPaidErrorCode, number> = {
  INVOICE_ZERO_TOTAL: 409,
  INVOICE_ALREADY_PAID: 409,
};

export class MarkPaidError extends Error {
  code: MarkPaidErrorCode;
  constructor(code: MarkPaidErrorCode, message: string) {
    super(message);
    this.name = "MarkPaidError";
    this.code = code;
  }
}

export interface RecordInvoicePaymentInput {
  notes: string | null;
}

const ALREADY_PAID_MESSAGE = "This invoice has already been marked as paid.";

function isUniqueViolationOnInvoiceId(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    String(error.meta?.target ?? "").includes("invoiceId")
  );
}

/**
 * Marks an Invoice PAID and creates the single Payment row representing its
 * full stored total. Race-safe: a conditional `updateMany` (PENDING -> PAID)
 * takes the row lock, so a losing concurrent call sees count 0 and fails
 * cleanly before any Payment is created; `Payment.invoiceId`'s unique
 * constraint is the final backstop, mapped to the same safe error.
 */
export async function recordInvoicePayment(
  invoiceId: string,
  input: RecordInvoicePaymentInput,
  db: typeof prismadb = prismadb
) {
  return db.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new InvoiceNotFoundError();

    if (invoice.total.isZero()) {
      throw new MarkPaidError(
        "INVOICE_ZERO_TOTAL",
        "This invoice has a zero total and is already paid; no payment can be recorded."
      );
    }

    const updateResult = await tx.invoice.updateMany({
      where: { id: invoiceId, paymentStatus: "PENDING" },
      data: { paymentStatus: "PAID" },
    });
    if (updateResult.count === 0) {
      throw new MarkPaidError("INVOICE_ALREADY_PAID", ALREADY_PAID_MESSAGE);
    }

    let payment;
    try {
      payment = await tx.payment.create({
        data: {
          invoiceId,
          amount: invoice.total,
          paymentDate: new Date(),
          notes: input.notes,
        },
      });
    } catch (error) {
      if (isUniqueViolationOnInvoiceId(error)) {
        throw new MarkPaidError("INVOICE_ALREADY_PAID", ALREADY_PAID_MESSAGE);
      }
      throw error;
    }

    const updated = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    return { invoice: updated, payment };
  });
}

export type RecordedPayment = Awaited<ReturnType<typeof recordInvoicePayment>>["payment"];

/** JSON-safe Payment: Decimal as string, dates ISO. */
export function serializePayment(payment: RecordedPayment) {
  return {
    id: payment.id,
    invoiceId: payment.invoiceId,
    amount: payment.amount.toFixed(),
    paymentDate: payment.paymentDate.toISOString(),
    notes: payment.notes,
    createdAt: payment.createdAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString(),
  };
}
