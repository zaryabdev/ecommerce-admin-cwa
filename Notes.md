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
