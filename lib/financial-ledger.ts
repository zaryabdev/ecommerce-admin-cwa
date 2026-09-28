import { Prisma } from "@prisma/client";

import { PreciseDecimal } from "@/lib/decimal";
import prismadb from "@/lib/prismadb";

// Release 1 Store financial ledger: derived at query time from Invoice (debit)
// and Payment (credit) rows only — never persisted, never a separate table,
// and never derived from Invoice.paymentStatus. A PKR 0 invoice is DEBIT 0
// with no Payment/credit row (it is auto-PAID at generation with no Payment
// created); this module must never fabricate one. Read-only: no mutations.

export type FinancialLedgerEntryType = "INVOICE" | "PAYMENT";

export interface FinancialLedgerEntry {
  type: FinancialLedgerEntryType;
  sourceId: string;
  invoiceId: string;
  invoiceNumber: string;
  date: string;
  debit: string | null;
  credit: string | null;
  balance: string;
  notes: string | null;
}

export interface StoreFinancialLedger {
  store: { id: string; name: string };
  summary: {
    totalDebit: string;
    totalCredit: string;
    outstandingBalance: string;
    currency: string;
  };
  entries: FinancialLedgerEntry[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
}

const DEFAULT_CURRENCY = "PKR";

type RawEntry = {
  type: FinancialLedgerEntryType;
  sourceId: string;
  invoiceId: string;
  invoiceNumber: string;
  date: Date;
  debit: Prisma.Decimal | null;
  credit: Prisma.Decimal | null;
  notes: string | null;
};

// Deterministic chronological order: transaction date/time first; at equal
// timestamps an INVOICE always resolves before a PAYMENT (so a same-instant
// Invoice + its own Payment applies the debit before the credit); source id
// is the final tiebreaker for anything still tied.
function compareChronological(a: RawEntry, b: RawEntry): number {
  const dateDiff = a.date.getTime() - b.date.getTime();
  if (dateDiff !== 0) return dateDiff;
  if (a.type !== b.type) return a.type === "INVOICE" ? -1 : 1;
  if (a.sourceId === b.sourceId) return 0;
  return a.sourceId < b.sourceId ? -1 : 1;
}

/**
 * Derives one Store's full transaction stream from Invoice + Payment,
 * computes the true chronological (oldest -> newest) running balance, then
 * presents it newest -> oldest, paginated. The summary is computed over
 * every transaction regardless of the requested page.
 */
export async function getStoreFinancialLedger(
  { storeId, page, pageSize }: { storeId: string; page: number; pageSize: number },
  db: typeof prismadb = prismadb
): Promise<StoreFinancialLedger | null> {
  const store = await db.store.findUnique({
    where: { id: storeId },
    select: { id: true, name: true },
  });
  if (!store) return null;

  const invoices = await db.invoice.findMany({
    where: { storeId },
    select: {
      id: true,
      invoiceNumber: true,
      invoiceDate: true,
      total: true,
      currency: true,
      payment: {
        select: { id: true, amount: true, paymentDate: true, notes: true },
      },
    },
  });

  const raw: RawEntry[] = [];
  const currencies = new Set<string>();

  for (const invoice of invoices) {
    currencies.add(invoice.currency);

    raw.push({
      type: "INVOICE",
      sourceId: invoice.id,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      date: invoice.invoiceDate,
      debit: invoice.total,
      credit: null,
      notes: null,
    });

    // Credits come only from an actual Payment row, never from paymentStatus:
    // a zero-total invoice is PAID with no Payment row and gets no credit here.
    if (invoice.payment) {
      raw.push({
        type: "PAYMENT",
        sourceId: invoice.payment.id,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        date: invoice.payment.paymentDate,
        debit: null,
        credit: invoice.payment.amount,
        notes: invoice.payment.notes,
      });
    }
  }

  if (currencies.size > 1) {
    // Platform billing is PKR-only; never silently mix currencies.
    throw new Error(
      `Mixed currencies in store ${storeId} financial ledger: ${Array.from(currencies).join(", ")}`
    );
  }
  const currency = currencies.size === 1 ? Array.from(currencies)[0] : DEFAULT_CURRENCY;

  raw.sort(compareChronological);

  let balance = new PreciseDecimal(0);
  let totalDebit = new PreciseDecimal(0);
  let totalCredit = new PreciseDecimal(0);

  // Ascending pass: this is the only place the true historical balance is
  // computed. Display order is reversed only after every entry has its real
  // balance, never recomputed per page.
  const ascending: FinancialLedgerEntry[] = raw.map((entry) => {
    if (entry.debit) {
      balance = balance.plus(entry.debit);
      totalDebit = totalDebit.plus(entry.debit);
    } else if (entry.credit) {
      balance = balance.minus(entry.credit);
      totalCredit = totalCredit.plus(entry.credit);
    }
    return {
      type: entry.type,
      sourceId: entry.sourceId,
      invoiceId: entry.invoiceId,
      invoiceNumber: entry.invoiceNumber,
      date: entry.date.toISOString(),
      debit: entry.debit ? entry.debit.toFixed() : null,
      credit: entry.credit ? entry.credit.toFixed() : null,
      balance: balance.toFixed(),
      notes: entry.notes,
    };
  });

  const descending = ascending.slice().reverse();
  const totalCount = descending.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const start = (page - 1) * pageSize;
  const entries = descending.slice(start, start + pageSize);

  return {
    store,
    summary: {
      totalDebit: totalDebit.toFixed(),
      totalCredit: totalCredit.toFixed(),
      outstandingBalance: totalDebit.minus(totalCredit).toFixed(),
      currency,
    },
    entries,
    pagination: { page, pageSize, totalCount, totalPages },
  };
}
