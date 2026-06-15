import os
import sys
import time

import uno
from com.sun.star.beans import PropertyValue


def prop(name, value):
    item = PropertyValue()
    item.Name = name
    item.Value = value
    return item


input_path = r"C:\ai\AI_for_Professional_24Days_Adarsha_Refined.docx"
output_dir = r"C:\ai\rendered_syllabus\pages"
os.makedirs(output_dir, exist_ok=True)

local_ctx = uno.getComponentContext()
resolver = local_ctx.ServiceManager.createInstanceWithContext(
    "com.sun.star.bridge.UnoUrlResolver", local_ctx
)

ctx = None
for _ in range(20):
    try:
        ctx = resolver.resolve(
            "uno:socket,host=localhost,port=2002;urp;StarOffice.ComponentContext"
        )
        break
    except Exception:
        time.sleep(0.5)

if ctx is None:
    raise RuntimeError("Could not connect to LibreOffice.")

desktop = ctx.ServiceManager.createInstanceWithContext(
    "com.sun.star.frame.Desktop", ctx
)
doc = desktop.loadComponentFromURL(
    uno.systemPathToFileUrl(input_path), "_blank", 0, (prop("Hidden", True),)
)
page_count = doc.CurrentController.PageCount
print(f"pages={page_count}")

for page_number in range(1, page_count + 1):
    out_path = os.path.join(output_dir, f"page-{page_number}.pdf")
    filter_data = (prop("PageRange", str(page_number)),)
    doc.storeToURL(
        uno.systemPathToFileUrl(out_path),
        (
            prop("FilterName", "writer_pdf_Export"),
            prop("FilterData", filter_data),
            prop("Overwrite", True),
        ),
    )

doc.close(True)
