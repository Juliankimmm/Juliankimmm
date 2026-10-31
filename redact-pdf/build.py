"""Builds RedactPDF.html: src/redact.html with pdf.js and jsPDF inlined so the single file works offline.
The libraries are shared with the invoice tool (../invoice-maker/vendor)."""
from pathlib import Path

here = Path(__file__).parent
vendor = here.parent / "invoice-maker" / "vendor"


def lib(name):
    code = (vendor / name).read_text(encoding="utf-8").replace("</script", "<\\/script")
    return "<script>\n" + code + "\n</script>\n"


# pdf.worker first: with its code on the page, pdf.js runs it in-page (no separate worker file is needed offline)
libs = lib("pdf.worker.min.js") + lib("pdf.min.js") + lib("jspdf.umd.min.js")
html = (here / "src" / "redact.html").read_text(encoding="utf-8")
assert "<!--LIBS-->" in html
(here / "RedactPDF.html").write_text(html.replace("<!--LIBS-->", libs, 1), encoding="utf-8")
print("Wrote RedactPDF.html")
