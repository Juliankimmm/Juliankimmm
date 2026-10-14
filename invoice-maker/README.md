# Invoice Maker

A single file, `InvoiceMaker.html`, that turns checked-off menu items into a PDF invoice. It doesn't need a website, an install or an internet connection.

## How to use
1. Double-click `InvoiceMaker.html`. It opens in Chrome, Edge or Safari.
2. **Step 1 – Customer:** pick a saved customer, or type a new one and click **★ Save as new customer**. The invoice # is filled in automatically.
3. **Step 2 – Services:** pick the date of the work, check the services, then click **Add checked**. Repeat for each date. Click ✎ on a menu item to rename it. The new name is kept for next time.
4. **Step 3 – Expenses:** add expenses the same way.
5. **Step 4 – Totals:** enter the previous balance and any payment received. You can also add a reduction (hours, a dollar amount or a percent of labor).
6. Click **⬇ Download PDF**. The PDF saves to Downloads, and the invoice is added to **Saved invoices**.

**Saved invoices** lists every invoice. **Open** changes one, **Copy** starts a new invoice from it and **PDF** downloads it again.

## Saving and backups
- Everything saves automatically in this browser on this computer: the menu, customers, saved invoices, letterhead, settings and the invoice in progress. You do **not** need to back up every time.
- **Backup** makes one file with everything in it. Use it to move to another computer or browser, or as a safety copy every few weeks. **Restore** loads that file and replaces what's there.
- Always open the file in the **same browser**.

## Letterhead
Go to ⚙ Settings → Letterhead and upload a PNG, JPG or PDF. PNG or JPG works best. For a PDF, the first page is used: drag the sliders so the preview shows just the letterhead. It prints in the same place it sits on the paper.

## Invoice numbers
Numbers look like `20260001`: the prefix `{YEAR}` plus 4 digits. You can change the format, or set the last number used, under ⚙ Settings → Invoice numbers. If you type a number by hand, the counter continues from it.

## For developers
Edit `src/app.html`, then run `python3 build.py` to rebuild `InvoiceMaker.html`. The build inlines jsPDF 2.5.2, jspdf-autotable 3.8.4 and pdf.js 3.11.174 from `vendor/`. pdf.js is stored as text and only runs when a PDF letterhead is uploaded.

All data is one object in `localStorage` (`invoiceMaker.v2`): `{ version, settings: { firm, letterhead, serviceMenu, expenseMenu, numbering }, customers[], invoices[], counters: { lastInvoiceNumber }, draft }`. Backup and restore use that same object. Older data (`invoiceMaker.v1` and v1 backup files) is converted automatically.
