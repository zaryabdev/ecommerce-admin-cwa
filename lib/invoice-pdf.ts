import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { Decimal } from "@prisma/client/runtime/library";

import { roundMoney } from "@/lib/decimal";
import prismadb from "@/lib/prismadb";

// Server-side invoice PDF, rendered ONLY from the persisted Invoice snapshot
// (plus live Store/billing-profile details for presentation). It never
// recalculates anything: later Order, Product or Billing Plan changes cannot
// alter the document. The same bytes serve the download route and the email
// attachment.

export class InvoiceNotFoundError extends Error {
  code = "INVOICE_NOT_FOUND" as const;
  constructor() {
    super("Invoice not found.");
    this.name = "InvoiceNotFoundError";
  }
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const billingPeriodLabel = (year: number, month: number) =>
  `${MONTH_NAMES[month - 1] ?? String(month)} ${year}`;

// String/Decimal-safe presentation: no float conversion, no calculation.
// Invoice components are already stored at 2 dp; eligible sales may carry more
// source precision and are only rounded for display.
export function formatPkr(amount: Decimal.Value): string {
  const fixed = roundMoney(amount).toFixed(2);
  const [integer, fraction] = fixed.replace("-", "").split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `PKR ${fixed.startsWith("-") ? "-" : ""}${grouped}.${fraction}`;
}

export const invoiceFilename = (invoiceNumber: string) =>
  `${invoiceNumber.replace(/[^A-Za-z0-9._-]/g, "_")}.pdf`;

const formatDateUtc = (date: Date) =>
  date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

export async function loadInvoiceForPdf(
  invoiceId: string,
  db: typeof prismadb = prismadb
) {
  return db.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      store: {
        select: { id: true, name: true, userId: true, billingProfile: true },
      },
    },
  });
}

export type InvoiceForPdf = NonNullable<Awaited<ReturnType<typeof loadInvoiceForPdf>>>;

// ---------- layout helpers ----------

const PAGE = { width: 595.28, height: 841.89, margin: 50 };
const INK = rgb(0.1, 0.12, 0.16);
const MUTED = rgb(0.42, 0.45, 0.5);
const RULE = rgb(0.82, 0.84, 0.87);

// Standard PDF fonts only encode WinAnsi. Anything else (e.g. Urdu store
// names, emoji) would make drawText throw, so it is replaced with "?".
const makeSanitizer = (font: PDFFont) => {
  const supported = new Set(font.getCharacterSet());
  return (text: string) =>
    Array.from(text.replace(/[\u0000-\u001f\u007f]/g, " "))
      .map((ch) => (supported.has(ch.codePointAt(0) as number) ? ch : "?"))
      .join("");
};

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      // Break a single over-long word by characters.
      let rest = word;
      while (font.widthOfTextAtSize(rest, size) > maxWidth) {
        let cut = rest.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > maxWidth) cut--;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      line = rest;
    }
    lines.push(line);
  }
  return lines;
}

/** Render the PDF from an already-loaded Invoice (pure: no DB, no calculation). */
export async function renderInvoicePdf(invoice: InvoiceForPdf): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  // Fixed metadata dates keep the output deterministic for a given Invoice.
  pdf.setTitle(`Invoice ${invoice.invoiceNumber}`);
  pdf.setCreationDate(invoice.createdAt);
  pdf.setModificationDate(invoice.createdAt);
  pdf.setProducer("Invoice service");
  pdf.setCreator("Invoice service");

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const clean = makeSanitizer(regular);

  let page: PDFPage = pdf.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - PAGE.margin;
  const left = PAGE.margin;
  const right = PAGE.width - PAGE.margin;
  const contentWidth = right - left;

  const ensureSpace = (needed: number) => {
    if (y - needed < PAGE.margin) {
      page = pdf.addPage([PAGE.width, PAGE.height]);
      y = PAGE.height - PAGE.margin;
    }
  };
  const text = (
    value: string,
    x: number,
    opts: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; align?: "left" | "right" } = {}
  ) => {
    const size = opts.size ?? 10;
    const font = opts.font ?? regular;
    const safe = clean(value);
    const width = font.widthOfTextAtSize(safe, size);
    page.drawText(safe, {
      x: opts.align === "right" ? x - width : x,
      y,
      size,
      font,
      color: opts.color ?? INK,
    });
  };
  const rule = (color = RULE) => {
    page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 0.7, color });
  };

  // ----- Header
  text("INVOICE", left, { size: 26, font: bold });
  const meta: [string, string][] = [
    ["Invoice number", invoice.invoiceNumber],
    ["Invoice date", formatDateUtc(invoice.invoiceDate)],
    ["Due date", formatDateUtc(invoice.dueDate)],
    ["Payment status", invoice.paymentStatus],
  ];
  const metaTop = y;
  for (const [label, value] of meta) {
    text(label, right - 190, { size: 9, color: MUTED });
    text(value, right, { size: 10, font: bold, align: "right" });
    y -= 15;
  }
  y = Math.min(y, metaTop - 40) - 20;
  rule();
  y -= 24;

  // ----- Billed to + billing period
  const profile = invoice.store.billingProfile;
  const billedTo: string[] = [
    profile?.legalName?.trim() || invoice.store.name,
    ...(profile?.legalName?.trim() && profile.legalName.trim() !== invoice.store.name
      ? [`Store: ${invoice.store.name}`]
      : []),
    ...(profile?.billingContactName?.trim() ? [`Attn: ${profile.billingContactName.trim()}`] : []),
    ...[profile?.addressLine1, profile?.addressLine2]
      .map((v) => v?.trim())
      .filter((v): v is string => Boolean(v)),
    [profile?.city, profile?.postalCode, profile?.country]
      .map((v) => v?.trim())
      .filter(Boolean)
      .join(", "),
    ...(profile?.taxNumber?.trim() ? [`Tax number: ${profile.taxNumber.trim()}`] : []),
    ...(profile?.companyRegistrationNumber?.trim()
      ? [`Registration no.: ${profile.companyRegistrationNumber.trim()}`]
      : []),
  ].filter(Boolean);

  const blockTop = y;
  text("BILLED TO", left, { size: 8, font: bold, color: MUTED });
  y -= 15;
  billedTo.forEach((line, i) => {
    for (const wrapped of wrap(clean(line), i === 0 ? bold : regular, 10, 240)) {
      text(wrapped, left, { font: i === 0 ? bold : regular });
      y -= 14;
    }
  });
  const leftBottom = y;

  y = blockTop;
  const colX = left + 300;
  text("BILLING PERIOD", colX, { size: 8, font: bold, color: MUTED });
  y -= 15;
  text(billingPeriodLabel(invoice.billingMonthYear, invoice.billingMonthMonth), colX, { font: bold });
  y -= 24;
  text("BILLING PLAN", colX, { size: 8, font: bold, color: MUTED });
  y -= 15;
  for (const wrapped of wrap(clean(invoice.billingPlanName), bold, 10, right - colX)) {
    text(wrapped, colX, { font: bold });
    y -= 14;
  }
  text(`Type: ${invoice.billingPlanType}`, colX);
  y -= 14;
  // Snapshot rule as stored: percentage is already in percentage points.
  if (invoice.billingPlanType === "FIXED" && invoice.fixedAmount !== null) {
    text(`Fixed amount: ${formatPkr(invoice.fixedAmount)}`, colX);
    y -= 14;
  } else if (invoice.billingPlanType === "PERCENTAGE" && invoice.percentageRate !== null) {
    text(`Rate: ${invoice.percentageRate.toFixed()}% of eligible sales`, colX);
    y -= 14;
  }
  y = Math.min(y, leftBottom) - 16;

  // ----- Financial breakdown
  ensureSpace(190);
  rule();
  y -= 20;
  text("DESCRIPTION", left, { size: 8, font: bold, color: MUTED });
  text(`AMOUNT (${invoice.currency})`, right, { size: 8, font: bold, color: MUTED, align: "right" });
  y -= 8;
  rule();
  y -= 18;

  const row = (label: string, amount: string, opts: { muted?: boolean; bold?: boolean } = {}) => {
    ensureSpace(20);
    text(label, left, { font: opts.bold ? bold : regular, color: opts.muted ? MUTED : INK });
    text(amount, right, { font: opts.bold ? bold : regular, color: opts.muted ? MUTED : INK, align: "right" });
    y -= 20;
  };
  row("Eligible sales for the period (informational)", formatPkr(invoice.eligibleSales), { muted: true });
  row("Base platform fee", formatPkr(invoice.basePlatformFee));
  row("Additional charge", formatPkr(invoice.additionalCharge));
  row("Discount", invoice.discount.isZero() ? formatPkr(0) : `- ${formatPkr(invoice.discount)}`);
  y += 6;
  rule(INK);
  y -= 22;
  ensureSpace(24);
  text("TOTAL", left, { size: 12, font: bold });
  text(formatPkr(invoice.total), right, { size: 12, font: bold, align: "right" });
  y -= 30;

  // ----- Payment + notes
  text("Payment status", left, { size: 9, color: MUTED });
  text(invoice.paymentStatus, left + 90, { font: bold });
  y -= 28;

  if (invoice.notes?.trim()) {
    ensureSpace(40);
    text("NOTES", left, { size: 8, font: bold, color: MUTED });
    y -= 15;
    for (const line of wrap(clean(invoice.notes.trim()), regular, 10, contentWidth)) {
      ensureSpace(14);
      text(line, left);
      y -= 14;
    }
  }

  return pdf.save();
}

/** Load the persisted Invoice and render its PDF. */
export async function generateInvoicePdf(
  invoiceId: string,
  db: typeof prismadb = prismadb
) {
  const invoice = await loadInvoiceForPdf(invoiceId, db);
  if (!invoice) throw new InvoiceNotFoundError();
  return {
    invoice,
    filename: invoiceFilename(invoice.invoiceNumber),
    bytes: await renderInvoicePdf(invoice),
  };
}

/** HTTP response for a rendered invoice PDF (download route). */
export const invoicePdfResponse = (filename: string, bytes: Uint8Array) =>
  new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "no-store",
    },
  });
