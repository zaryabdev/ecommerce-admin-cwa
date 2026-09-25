import { resolveStoreOwnerEmail } from "@/lib/email/resolve-store-owner-email";
import {
  InvoiceNotFoundError,
  billingPeriodLabel,
  formatPkr,
  generateInvoicePdf,
} from "@/lib/invoice-pdf";
import prismadb from "@/lib/prismadb";
import { getResendClient } from "@/lib/resend";

// Invoice email delivery. Independent of Invoice creation: the Invoice already
// exists and is never created, recalculated or otherwise modified here. Only
// the email-delivery fields change:
//   emailStatus        result of the MOST RECENT attempt (SENT / FAILED)
//   emailSentAt        time of the most recent SUCCESSFUL send (kept on failure)
//   lastEmailAttemptAt most recent attempt, success or failure
//   emailAttemptCount  total attempts, incremented atomically (never lost)
//   emailError         latest failure summary (safe, bounded); cleared on success
//
// Concurrency: no transaction spans the external call. Each attempt first
// records itself with an atomic increment, then finishes with a separate
// update of status fields. Concurrent attempts therefore always count
// correctly; which of them writes the final emailStatus is last-writer-wins.

const MAX_ERROR_LENGTH = 300;

// Errors whose message is already safe and useful to store/return.
class DeliveryError extends Error {}

const bound = (message: string) =>
  message.replace(/\s+/g, " ").trim().slice(0, MAX_ERROR_LENGTH);

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

export interface EmailSender {
  emails: {
    send(message: {
      from: string;
      to: string;
      subject: string;
      html: string;
      text: string;
      attachments: { filename: string; content: Buffer; contentType: string }[];
    }): Promise<{ data?: { id?: string } | null; error?: { name?: string; message?: string } | null }>;
  };
}

export interface InvoiceEmailDeps {
  db?: typeof prismadb;
  /** Provider client; null = not configured. Defaults to the shared Resend client. */
  getEmailSender?: () => EmailSender | null;
  from?: string | undefined;
  resolveRecipient?: (userId: string) => Promise<string | null>;
}

export type InvoiceDeliveryResult = {
  invoice: NonNullable<Awaited<ReturnType<typeof loadDelivered>>>;
  delivery: { status: "SENT" | "FAILED"; error: string | null };
};

const loadDelivered = (db: typeof prismadb, invoiceId: string) =>
  db.invoice.findUnique({ where: { id: invoiceId } });

export async function deliverInvoiceEmail(
  invoiceId: string,
  {
    db = prismadb,
    getEmailSender = () => getResendClient() as unknown as EmailSender | null,
    from = process.env.RESEND_FROM_EMAIL?.trim(),
    resolveRecipient = resolveStoreOwnerEmail,
  }: InvoiceEmailDeps = {}
): Promise<InvoiceDeliveryResult> {
  // 1. The Invoice must already exist. Nothing else is read for financials.
  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    select: { id: true },
  });
  if (!invoice) throw new InvoiceNotFoundError();

  // 2. Record the attempt atomically before doing any work (also counts
  //    attempts that fail before reaching the provider).
  const attemptedAt = new Date();
  await db.invoice.update({
    where: { id: invoiceId },
    data: {
      emailAttemptCount: { increment: 1 },
      lastEmailAttemptAt: attemptedAt,
    },
  });

  let failure: string | null = null;
  try {
    // 3. Everything below can fail without affecting the Invoice.
    const { invoice: doc, filename, bytes } = await generateInvoicePdf(invoiceId, db).catch(
      (error) => {
        if (error instanceof InvoiceNotFoundError) throw error;
        console.error("[INVOICE_EMAIL] PDF generation failed", error);
        throw new DeliveryError("Could not generate the invoice PDF.");
      }
    );

    const recipient = await resolveRecipient(doc.store.userId).catch((error) => {
      console.error("[INVOICE_EMAIL] recipient lookup failed", error);
      throw new DeliveryError("Could not resolve the store owner's email address.");
    });
    if (!recipient) {
      throw new DeliveryError("Store owner has no usable email address.");
    }

    const sender = getEmailSender();
    if (!sender || !from) {
      throw new DeliveryError("Email delivery is not configured.");
    }

    const period = billingPeriodLabel(doc.billingMonthYear, doc.billingMonthMonth);
    const total = formatPkr(doc.total);
    const rows: [string, string][] = [
      ["Store", doc.store.name],
      ["Invoice number", doc.invoiceNumber],
      ["Billing period", period],
      ["Total", total],
      ["Payment status", doc.paymentStatus],
    ];
    const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.5"><h2>Invoice ${escapeHtml(doc.invoiceNumber)}</h2><p>An invoice has been issued for ${escapeHtml(period)}. The invoice PDF is attached.</p><table style="border-collapse:collapse;width:100%;max-width:520px">${rows
      .map(
        ([label, value]) =>
          `<tr><th style="text-align:left;padding:8px;border-bottom:1px solid #e5e7eb;width:160px">${escapeHtml(label)}</th><td style="padding:8px;border-bottom:1px solid #e5e7eb">${escapeHtml(value)}</td></tr>`
      )
      .join("")}</table></body></html>`;
    const textBody = [
      `Invoice ${doc.invoiceNumber}`,
      `An invoice has been issued for ${period}. The invoice PDF is attached.`,
      "",
      ...rows.map(([label, value]) => `${label}: ${value}`),
    ].join("\n");

    let result;
    try {
      result = await sender.emails.send({
        from,
        to: recipient,
        subject: `Invoice ${doc.invoiceNumber} — ${period}`,
        html,
        text: textBody,
        attachments: [
          { filename, content: Buffer.from(bytes), contentType: "application/pdf" },
        ],
      });
    } catch (error) {
      console.error("[INVOICE_EMAIL] provider request failed", error);
      throw new DeliveryError("Email provider request failed.");
    }
    // The provider reports rejections in the result, not by throwing.
    if (result.error) {
      console.error("[INVOICE_EMAIL] provider rejected the email", result.error);
      throw new DeliveryError(
        bound(`Email provider error: ${result.error.name ?? "error"}: ${result.error.message ?? "rejected"}`)
      );
    }
    console.info(`[INVOICE_EMAIL] sent ${doc.invoiceNumber} (provider id ${result.data?.id ?? "n/a"})`);
  } catch (error) {
    if (error instanceof InvoiceNotFoundError) throw error;
    if (error instanceof DeliveryError) {
      failure = bound(error.message);
    } else {
      console.error("[INVOICE_EMAIL] unexpected delivery failure", error);
      failure = "Email delivery failed.";
    }
  }

  // 4. Finish the attempt. Only email-delivery fields are written; on failure
  //    emailSentAt (an earlier successful send) is deliberately left alone.
  const updated = await db.invoice.update({
    where: { id: invoiceId },
    data: failure
      ? { emailStatus: "FAILED", emailError: failure }
      : { emailStatus: "SENT", emailSentAt: attemptedAt, emailError: null },
  });

  return {
    invoice: updated,
    delivery: failure
      ? { status: "FAILED", error: failure }
      : { status: "SENT", error: null },
  };
}
