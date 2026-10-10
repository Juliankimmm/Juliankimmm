"""Builds InvoiceMaker.html: src/app.html with the PDF libraries inlined so it works offline."""
from pathlib import Path

here = Path(__file__).parent
html = (here / "src" / "app.html").read_text(encoding="utf-8")
libs = "".join(
    "<script>\n" + (here / "vendor" / name).read_text(encoding="utf-8").replace("</script", "<\\/script") + "\n</script>\n"
    for name in ("jspdf.umd.min.js", "jspdf.plugin.autotable.min.js")
)
(here / "InvoiceMaker.html").write_text(html.replace("<!--LIBS-->", libs, 1), encoding="utf-8")
print("Wrote InvoiceMaker.html")
