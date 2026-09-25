import prismadb from "@/lib/prismadb";
import { serializeInvoice } from "@/lib/invoice-generation";

// Read-only Invoice queries for the privileged Super Admin API. Everything
// comes from the persisted Invoice snapshot; nothing is recalculated.

export const INVOICE_DEFAULT_PAGE_SIZE = 20;
export const INVOICE_MAX_PAGE_SIZE = 100;

export async function listInvoices(
  {
    storeId,
    page,
    pageSize,
  }: { storeId?: string; page: number; pageSize: number },
  db: typeof prismadb = prismadb
) {
  const where = storeId ? { storeId } : {};

  const [totalCount, rows] = await Promise.all([
    db.invoice.count({ where }),
    db.invoice.findMany({
      where,
      // id tiebreaker keeps page boundaries stable for equal timestamps.
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        invoiceNumber: true,
        storeId: true,
        billingMonthYear: true,
        billingMonthMonth: true,
        invoiceDate: true,
        dueDate: true,
        total: true,
        currency: true,
        paymentStatus: true,
        emailStatus: true,
        emailSentAt: true,
        emailAttemptCount: true,
        store: { select: { name: true } },
      },
    }),
  ]);

  return {
    invoices: rows.map((row) => ({
      id: row.id,
      invoiceNumber: row.invoiceNumber,
      storeId: row.storeId,
      storeName: row.store.name,
      billingMonthYear: row.billingMonthYear,
      billingMonthMonth: row.billingMonthMonth,
      invoiceDate: row.invoiceDate.toISOString(),
      dueDate: row.dueDate.toISOString(),
      total: row.total.toFixed(),
      currency: row.currency,
      paymentStatus: row.paymentStatus,
      emailStatus: row.emailStatus,
      emailSentAt: row.emailSentAt?.toISOString() ?? null,
      emailAttemptCount: row.emailAttemptCount,
    })),
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
    },
  };
}

/** Full stored snapshot (incl. email-delivery state) plus Store display info. */
export async function getInvoiceDetail(
  invoiceId: string,
  db: typeof prismadb = prismadb
) {
  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: { store: { select: { id: true, name: true } } },
  });
  if (!invoice) return null;
  return { ...serializeInvoice(invoice), store: invoice.store };
}
