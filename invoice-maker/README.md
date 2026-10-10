# Invoice Maker

A single file, `InvoiceMaker.html`, that turns checked-off menu items into a PDF invoice. It doesn't need a website, an install or an internet connection.

## How to use
1. Double-click `InvoiceMaker.html`. It opens in Chrome, Edge or Safari.
2. **Step 1:** Fill in the client, case and invoice date. Click **★ Save this client** so you can pick the client from the list next time.
3. **Step 2:** Pick the date of the work, check the services you did, then click **Add checked**. Repeat for each date. You can edit any line afterwards (hours, rate, wording, no charge).
4. **Step 3:** Add expenses the same way.
5. **Step 4:** Enter the previous balance, any payment received and any voluntary reduction hours.
6. Click **⬇ Download PDF invoice**. The PDF saves to Downloads as `Invoice_YYYYMMDD_ClientName.pdf`.

## The menu
- **+ New menu item** adds a service or expense to the menu.
- The **★** button on an invoice line saves that line to the menu.
- **✎** edits a menu item, **✕** deletes it and **↑** moves it up.
- Everything saves on its own: the menu, clients, letterhead and the invoice in progress.

The data is saved inside the browser on this computer. Always open the file in the **same browser** and keep it in the **same folder**. Every so often, click **Backup menu** to save a backup file. **Restore backup** loads that file again, for example on a new computer.

## For developers
Edit `src/app.html`, then run `python3 build.py` to rebuild `InvoiceMaker.html`. The build inlines jsPDF 2.5.2 and jspdf-autotable 3.8.4 from `vendor/`.
