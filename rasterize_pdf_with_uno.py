import os
import time

import uno
from com.sun.star.beans import PropertyValue


def prop(name, value):
    item = PropertyValue()
    item.Name = name
    item.Value = value
    return item


input_path = r"C:\ai\rendered_syllabus\AI_for_Professional_24Days_Adarsha_Refined.pdf"
output_dir = r"C:\ai\rendered_syllabus\page_images"
os.makedirs(output_dir, exist_ok=True)

local_ctx = uno.getComponentContext()
resolver = local_ctx.ServiceManager.createInstanceWithContext(
    "com.sun.star.bridge.UnoUrlResolver", local_ctx
)

ctx = None
for _ in range(20):
    try:
        ctx = resolver.resolve(
            "uno:socket,host=localhost,port=2003;urp;StarOffice.ComponentContext"
        )
        break
    except Exception:
        time.sleep(0.5)

if ctx is None:
    raise RuntimeError("Could not connect to LibreOffice.")

smgr = ctx.ServiceManager
desktop = smgr.createInstanceWithContext("com.sun.star.frame.Desktop", ctx)
doc = desktop.loadComponentFromURL(
    uno.systemPathToFileUrl(input_path), "_blank", 0, (prop("Hidden", True),)
)
pages = doc.getDrawPages()
print(f"pages={pages.getCount()}")

for index in range(pages.getCount()):
    exporter = smgr.createInstanceWithContext(
        "com.sun.star.drawing.GraphicExportFilter", ctx
    )
    exporter.setSourceDocument(pages.getByIndex(index))
    exporter.filter(
        (
            prop("MediaType", "image/png"),
            prop(
                "URL",
                uno.systemPathToFileUrl(
                    os.path.join(output_dir, f"page-{index + 1}.png")
                ),
            ),
            prop("PixelWidth", 1275),
            prop("PixelHeight", 1650),
        )
    )

doc.close(True)
