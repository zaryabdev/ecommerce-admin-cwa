These files are the current project context for today's work.

Treat:

- PROJECT_BRIEF.md as the system-level overview
- projects/*/CONTEXT.md as current portable project context
- DECISIONS.md as durable decisions
- the latest Chat Resume as continuity from the previous session

Historical chat resumes are not current source of truth.

Today's focus is:
<describe today's task>

Before proposing implementation, tell me:

1. What you understand the current state to be
2. What remains from the previous session that affects today's task
3. Which repository/repositories this task affects
4. Any important existing decisions or constraints I should keep in mind

---

This task is complete.

**Permanent Invoice Generation — done.**

The implementation satisfies the important financial and concurrency guarantees:

- server recalculates everything at generation time
- `RepeatableRead` transaction gives the calculation a consistent snapshot
- current Store plan wins at generation time
- archived-but-assigned plans remain valid
- preview and generation now share the same 2-decimal `ROUND_HALF_UP` rules
- invoice snapshot is immutable after persistence
- Store+month uniqueness is protected both explicitly and by the DB constraint
- concurrent generation produces exactly one invoice
- zero invoices persist as `PAID` without a Payment row
- positive invoices persist as `PENDING`
- email remains `NOT_SENT`
- invoice creation is completely independent of future PDF/email work
- invoice-number collisions are handled safely
- all disposable data was removed
- 46/46 substantive checks passed

Rerunning the whole transaction on PostgreSQL after a failed unique insert is also the correct adjustment. Once a statement errors, the transaction cannot simply continue with another insert, so Claude's implementation is better than literally retrying only `create()`.

### One thing to check before committing

Your report says the repository is currently on **`main`**.

All of our earlier Admin work was being done on `dev`. If `main` is intentional, that's fine. If not, **don't commit this work on `main` yet**; move/preserve the changes onto the intended branch first.

Otherwise, I would mark **Permanent Invoice Generation** complete.

The next backend task in our sequence is:

**Invoice PDF + Email Delivery**

That should be treated as two closely connected concerns while preserving the rule that the **Invoice DB record succeeds independently of email delivery**. A failed PDF/email send must never roll back or recreate the financial invoice.

---

For your manual test, I’d focus on this single end-to-end path:

Preview an invoice and verify the amounts.
Generate it and verify exactly one Invoice exists.
Confirm the generated PDF visually:
invoice number/month/dates
Store/billing details
plan
eligible sales
fee/charge/discount/total
payment status
notes
Confirm the actual email reaches the Store owner with that exact PDF attached.
Download the PDF through the new PDF route and compare it with the attachment.
Use Resend Email and confirm attempt count/status update without creating another Invoice.
Optionally force one delivery failure and verify the Invoice remains intact and Resend recovers it.

---

You can now test the **whole billing flow manually from Preview → Permanent Invoice → PDF → Email → Resend**. Since the Super Admin invoice-management UI is not built yet, I’d test the backend endpoints directly first.

Use a **dev Store** and set `RESEND_TEST_RECIPIENT` to your own email before testing. The current email resolver supports that override, so you can test real delivery without accidentally emailing a Store owner.

1. **Prepare one clean test Store.** Assign it a valid Billing Plan. For the first test, use something easy to verify manually, e.g. `PERCENTAGE = 5`. Create or use Orders for a completed past UTC month. Make sure at least one is `CONFIRMED` or `DELIVERED` with `confirmedAt` inside that month. Keep a `DRAFT` and `CANCELED` Order around too so you can confirm they are excluded.

2. **Test Invoice Preview first.** Call:

    ```http
    POST /api/super-admin/stores/{storeId}/invoices/preview
    ```

    with something like:

    ```json
    {
        "billingMonthYear": 2026,
        "billingMonthMonth": 8,
        "additionalCharge": "500",
        "discount": "100",
        "notes": "Manual billing test"
    }
    ```

    Verify `eligibleSales`, `basePlatformFee`, `additionalCharge`, `discount`, `total`, `paymentStatus`, and the Billing Plan snapshot. For a 5% plan, the fee should be `eligibleSales × 5 / 100`. The preview should show invoice-facing amounts at 2 decimals.

3. **Generate the permanent Invoice using the exact same request.** Call:

    ```http
    POST /api/super-admin/stores/{storeId}/invoices
    ```

    You should get **201 Created**. Verify the response contains a number such as:

    ```text
    INV-202608-XXXXXXXXXXXXXXX
    ```

    and check that `invoiceDate` equals `dueDate`. The generated Invoice must match a fresh server-side recalculation, not blindly copy your earlier preview.

4. **Check the automatic email result.** Because generation now commits the Invoice first and then attempts delivery, one of two outcomes is valid:

    - `emailStatus: "SENT"` — your test inbox should receive the email with the PDF.
    - `emailStatus: "FAILED"` — the Invoice must still exist and generation must still have returned 201. This separation is intentional.

5. **Open/download the PDF manually.** Call:

    ```http
    GET /api/super-admin/invoices/{invoiceId}/pdf
    ```

    Open the downloaded PDF and visually check: invoice number, billing period, invoice/due dates, Store/billing details, plan name/type, eligible sales, base fee, additional charge, discount, total, payment status, and notes. Claude verified the PDF structurally but deliberately left the visual review to you.

6. **Compare the email attachment against the download.** The email attachment and PDF endpoint use the same PDF-generation path, so visually they should contain the same invoice information. The attachment filename should be `{invoiceNumber}.pdf`.

7. **Test duplicate generation.** Send the same generation request again for the same Store + billing month. It should **not create another invoice**. You should get `INVOICE_ALREADY_EXISTS` / conflict. Then verify only one Invoice exists in the database.

8. **Test Resend Email.** Call:

    ```http
    POST /api/super-admin/invoices/{invoiceId}/send-email
    ```

    On success, expect HTTP 200 and `emailStatus: "SENT"`. Verify `emailAttemptCount` increased and `emailSentAt` / `lastEmailAttemptAt` updated. It is valid to resend an already-sent Invoice too.

9. **Test the failure-and-recovery path — this one is important.** Temporarily break the Resend configuration in your dev environment, for example use an invalid test API key or invalid sender config, restart the app, and generate an Invoice for a different Store/month. Expected result: Invoice generation still returns **201**, the Invoice remains in the DB, and `emailStatus` becomes `FAILED`. Restore the correct Resend configuration, then call `send-email` for that same Invoice. It should transition to `SENT`; do **not** generate the Invoice again.

10. **Check email metadata after failure/retry.** After a failed attempt you should see `FAILED`, an incremented `emailAttemptCount`, a `lastEmailAttemptAt`, and a safe `emailError`. After a successful retry, the error clears and the count increments again. If a previously successful resend later fails, `emailSentAt` should retain the previous successful timestamp while the latest status becomes `FAILED`.

11. **Test financial immutability.** After generating an Invoice, change the Store's Billing Plan assignment, edit the plan amount/name, change a Product price, or add another eligible Order to that historical month. Then download the Invoice PDF again. The stored financial values must remain unchanged. One known limitation: changing `StoreBillingProfile` can change the regenerated PDF's non-financial **Billed To** information because that data is currently live rather than snapshotted.

12. **Test a PKR 0 Invoice.** Easiest options are a FIXED plan of `0`, a 0% plan, or a discount equal to fee + charge. Generate it and verify the Invoice is still created, `paymentStatus = PAID`, and **no Payment row exists**.

13. **Test the main guards once.** Current UTC month should be rejected, future month should be rejected, an archived-but-still-assigned Billing Plan should still generate successfully, a stored percentage above 100 should be rejected defensively, and an unauthenticated request should return 401.

For your first pass, I’d specifically do **one successful percentage Invoice**, **one zero Invoice**, and **one intentionally failed-email Invoice followed by Resend**. Those three scenarios exercise almost everything important without turning the manual test into a huge regression suite.

---

The implementation looks solid. I’d classify **Super Admin Invoice UI / Invoice History as implementation-complete, with manual acceptance testing still pending**. Both repos pass TypeScript, lint and build, and Admin’s new read endpoints passed 10/10 disposable-data checks.

The UI now gives you the complete surface you wanted: `/invoices`, invoice detail, Store invoice history, Preview, Generate & Send, PDF download/open, failed-email handling, and Resend. The Generate dialog also correctly distinguishes a successfully created invoice whose email failed — it does **not** offer Generate again and instead gives Resend/PDF/View actions.

### What I would test first

You no longer need Postman for the main flow. In the UI, do these scenarios in this order:

1. **PERCENTAGE invoice**

    - assign a 5% or 2.5% plan
    - open Generate Invoice
    - select a completed month
    - Preview
    - verify eligible sales and calculation
    - Generate & Send
    - verify email
    - Download PDF
    - open Invoice detail

2. **FIXED invoice**

    - assign a fixed plan
    - preview and generate
    - confirm eligible sales are shown but do not affect the fixed fee

3. **Additional Charge + Discount**

    - e.g. charge `250.50`
    - valid discount
    - then try a discount larger than fee + charge and confirm rejection.

4. **Zero invoice**

    - use FIXED `0`, 0%, or full discount
    - verify Invoice is created as `PAID`

5. **Failed email → Resend**

    - deliberately break the email configuration in dev
    - Generate
    - verify UI says **invoice generated successfully, but email delivery failed**
    - restore email config
    - Resend
    - verify status moves from FAILED → SENT and attempt count increments.

6. **Duplicate month**

    - try Preview/Generate again for the same Store/month
    - confirm the UI clearly says an invoice already exists and the existing row remains visible.

7. **Archived assigned plan**

    - archive the plan while it remains assigned
    - Preview should still work and display the archived-assignment note.

8. **Refresh/persistence**

    - reload `/invoices`
    - reload invoice detail
    - reload Store detail
    - verify history, `?storeId=` filter and pagination remain correct.

### One documentation issue

Your **AI-context update that is already running may now be one task behind**, because this Invoice UI finished after you started that documentation refresh. Claude explicitly says this latest work was **not** added to `ecommerce_ai_context`; the newly added invoice read APIs and Super Admin UI still need to be recorded.

Let the current context update finish first. Afterward, we should give Claude a **small follow-up context-sync prompt** containing only this new Invoice UI/read-API work rather than rerunning the whole large documentation task.

Also, Admin's `Todo.md` still contains stale granular sections farther down even though the top-level invoice items are updated. That is cleanup rather than a feature blocker, but I would fix it before Release 1 so the checklist remains trustworthy.

---
