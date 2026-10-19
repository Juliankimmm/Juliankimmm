# Invoice Maker

A single file, `InvoiceMaker.html`, that turns checked-off menu items into a PDF invoice. It doesn't need a website, an install or an internet connection.

## How to use
1. Double-click `InvoiceMaker.html`. It opens in Chrome, Edge or Safari.
2. **Step 1 – Customer:** pick a saved customer, or type a new one and click **★ Save as new customer**. The invoice # is filled in automatically.
3. **Step 2 – Services:** pick the date of the work, check the services, then click **Add checked**. Repeat for each date. Click ✎ on a menu item to rename it. The new name is kept for next time. **🗑 Delete all services** clears the lines, for example when starting an invoice for a different client.
4. **Step 3 – Expenses:** add expenses the same way.
5. **Step 4 – Totals:** enter the previous balance and any payment received. You can also add a reduction (hours, a dollar amount or a percent of labor).
6. Click **⬇ Download PDF**. The PDF saves to Downloads, and the invoice is added to **Saved invoices**.

**Saved invoices** lists every invoice. **Open** changes one, **Copy** starts a new invoice from it and **PDF** downloads it again.

## Invoice folder (Chrome or Edge)
Under ⚙ Settings → Invoice folder, click **Choose folder…** once and pick a folder, for example a new **Invoices** folder inside Documents. After that, **⬇ Save PDF to folder** saves each invoice like this:

```
Invoices/
  _InvoiceMaker backup.json        ← full backup, updated automatically
  _Older backups/                  ← earlier backups, kept when something was removed
  Sung Man Kim/
    _Invoice list.csv              ← his details + every invoice with totals (opens in Excel)
    2026-09-10 Invoice 20260001.pdf
    2026-10-16 Invoice 20260002.pdf
  Jane Doe/
    ...
```

- Files are named by date, so each customer's folder lists their invoices in order.
- If you change an invoice's date, number or customer and save again, its PDF is renamed or moved. No old copy is left behind.
- Two different saved customers with the same name get separate folders, e.g. "John Kim" and "John Kim (2)".
- **Save all saved invoices into the folder** puts invoices you saved before choosing the folder into it.
- After the browser restarts, it asks once to allow saving into the folder. That happens at the first **Save PDF to folder**, or click **📁 Allow invoice folder** at the top. Choose **Allow**, or **Allow on every visit** if it's offered.
- **New computer, or browser data cleared?** Choose the same folder again. If it holds a backup with invoices that aren't in the browser, you'll be asked whether to load it.
- When the backup in the folder is about to be replaced and it has invoices or customers that aren't in the browser (for example, after you delete an invoice), it's kept first in `_Older backups`.
- If the folder can't be used (moved, renamed or not allowed), the PDF goes to Downloads instead and a message says why.
- In Safari or Firefox this option isn't available, and PDFs go to Downloads as before.

## Saving and backups
- Everything saves automatically in this browser on this computer: the menu, customers, saved invoices, letterhead, settings and the invoice in progress. You do **not** need to back up every time.
- **Backup** makes one file with everything in it. Use it to move to another computer or browser, or as a safety copy every few weeks. **Restore** loads that file and replaces what's there.
- Always open the file in the **same browser**.

## Letterhead
By default the firm's letterhead is printed as sharp text, laid out like the printed stationery: the attorney on the left, the NJ office in the middle and the NY office on the right, in small capitals. Every line can be changed under ⚙ Settings → Letterhead. Leave a box empty to leave that part out, and press **Preview** to see the result.

You can also upload a letterhead instead (PNG, JPG or PDF). An uploaded letterhead replaces the typed one until you click **Remove letterhead**.
- **A wide image of just the letterhead** (like a scan or screenshot of the top of the stationery) prints across the full width. Use the size slider to adjust it.
- **A whole page (a PDF)** uses its first page. Drag the sliders so the preview shows only the letterhead. It prints in the same place it sits on the paper.

## Invoice numbers
Numbers look like `20260001`: the prefix `{YEAR}` plus 4 digits. You can change the format, or set the last number used, under ⚙ Settings → Invoice numbers. If you type a number by hand, the counter continues from it.

## For developers
Edit `src/app.html` (and `src/letterhead.js`, which draws the typed letterhead), then run `python3 build.py` to rebuild `InvoiceMaker.html`. The build inlines jsPDF 2.5.2, jspdf-autotable 3.8.4 and pdf.js 3.11.174 from `vendor/`. pdf.js is stored as text and only runs when a PDF letterhead is uploaded.

All data is one object in `localStorage` (`invoiceMaker.v2`): `{ version, settings: { firm, letterhead, serviceMenu, expenseMenu, numbering }, customers[], invoices[], counters: { lastInvoiceNumber }, draft }`. Backup and restore use that same object. Older data (`invoiceMaker.v1` and v1 backup files) is converted automatically.
