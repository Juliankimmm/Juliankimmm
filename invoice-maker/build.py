"""Builds InvoiceMaker.html: src/app.html with every library inlined so the single file works offline."""
from pathlib import Path

here = Path(__file__).parent


def lib(name, script_type=None, script_id=None):
    code = (here / "vendor" / name).read_text(encoding="utf-8").replace("</script", "<\\/script")
    attrs = (f' type="{script_type}"' if script_type else "") + (f' id="{script_id}"' if script_id else "")
    return f"<script{attrs}>\n{code}\n</script>\n"


libs = (
    lib("jspdf.umd.min.js")
    + lib("jspdf.plugin.autotable.min.js")
    # pdf.js is only needed when a PDF letterhead is uploaded, so it is stored as text and run on demand.
    + lib("pdf.worker.min.js", "text/plain", "lib-pdf-worker")
    + lib("pdf.min.js", "text/plain", "lib-pdf")
)
html = (here / "src" / "app.html").read_text(encoding="utf-8")
assert "<!--LIBS-->" in html
(here / "InvoiceMaker.html").write_text(html.replace("<!--LIBS-->", libs, 1), encoding="utf-8")
print("Wrote InvoiceMaker.html")
