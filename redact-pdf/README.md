# PDF Redactor

`RedactPDF.html` is a single file that blacks out names, addresses, Social Security numbers or any other words in a PDF, permanently. Double-click it to open it in Chrome, Edge, Safari or Firefox. It works offline, and the PDF never leaves the computer.

## How to use
1. **Open a PDF:** drop it on the box, or click to choose one. Password-protected PDFs ask for the password.
2. **Type what to black out**, one item per line. Matches turn black on the page previews as you type, and the list shows how many of each were found ("not found" usually means a typo).
   - **Case-sensitive:** "Kim" won't match "KIM".
   - **Whole words only:** "Kim" won't match "Kimberly".
   - **Also find automatically:** Social Security numbers, email addresses, phone numbers.
   - A name is still found when it is split across two lines or written in a different case (unless Case-sensitive is on).
   - Filled-in form fields that contain a match are blacked out as a whole.
3. **Check the pages:**
   - **Drag** on a page to black out anything else, such as a signature, a photo or scanned text.
   - **Click** a black box to keep that one spot visible. Click it again to black it out again.
   - **Click** a box you drew to remove it.
   - **See through the boxes** shows what is under them on screen. It never affects the saved file.
4. **Save redacted PDF.** The file is named `<name>_redacted.pdf`.
   - Saving the same PDF again gives `<name>_redacted (1).pdf`, then `(2)`, and so on.
   - Redacting a file that is already `_redacted` continues the count instead of adding `_redacted_redacted`.
   - If the file name itself contains a word you are blacking out, the tool warns you so you can rename it.

## Why it can't be undone
Many tools only draw a black rectangle on top of the text, and the text can still be copied out from underneath. This tool rebuilds every page as a flat picture with the black boxes burned into the pixels. The saved PDF contains only those pictures: no text, fonts, form fields, comments, bookmarks, attachments or document information (title, author and so on) from the original.

After saving, the tool reopens the new file and confirms that it has no text, form fields, comments or bookmarks before handing it over.

## Limits to know
- **No selectable text:** the saved file is pictures of the pages, so its text can't be selected or searched. Keep the original somewhere safe.
- **Scanned pages** have no typed text, so words on them can't be found automatically. The tool marks those pages; drag boxes over what needs hiding.
- **File size:** about 150–400 KB per page at the default quality (150 dpi). The higher quality settings make sharper but bigger files.
- **Check the result:** always look over the saved file before sending it. The tool only finds what you type, exactly as it appears in the PDF.

## For developers
Edit `src/redact.html`, then run `python3 build.py` to rebuild `RedactPDF.html`. The build inlines pdf.js 3.11.174 and jsPDF 2.5.2 from `../invoice-maker/vendor`.
