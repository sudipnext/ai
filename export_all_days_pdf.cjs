const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { chromium } = require("C:/Users/paraj/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright");
const { PDFDocument, rgb } = require("C:/Users/paraj/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/pdf-lib@1.17.1/node_modules/pdf-lib");

const root = "C:/ai";
const work = path.join(root, "outputs", "html-pdf-export");
const shots = path.join(work, "slides");
const deliverables = path.join(root, "deliverables");
const edge = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const days = [1, 2, 3, 4, 5, 6].map((day) => ({
  day,
  html: path.join(root, `day${day}`, "index.html"),
}));

fs.mkdirSync(shots, { recursive: true });
fs.mkdirSync(deliverables, { recursive: true });

const exportCss = `
  html,body{width:1280px!important;height:720px!important;min-width:1280px!important;min-height:720px!important;margin:0!important;overflow:hidden!important;background:#fff!important}
  .app{display:block!important;width:1280px!important;height:720px!important}
  .side,.sidebar,.bottom,.bottom-help,.notes,.confetti{display:none!important}
  .stage{display:block!important;width:1280px!important;height:720px!important;padding:0!important}
  .shell,.deck-shell{display:block!important;width:1280px!important;height:720px!important}
  .deck{width:1280px!important;height:720px!important;max-width:none!important;aspect-ratio:auto!important;border:0!important;border-radius:0!important;box-shadow:none!important;overflow:hidden!important}
  .slide{position:absolute!important;inset:0!important;width:1280px!important;height:720px!important;aspect-ratio:auto!important;border-radius:0!important}
`;

async function makePdf(imagePaths, outputPath) {
  const pdf = await PDFDocument.create();
  const pageW = 841.89;
  const pageH = 595.28;
  const imageW = pageW;
  const imageH = imageW * 720 / 1280;
  const imageY = (pageH - imageH) / 2;
  for (const imagePath of imagePaths) {
    const page = pdf.addPage([pageW, pageH]);
    page.drawRectangle({ x: 0, y: 0, width: pageW, height: pageH, color: rgb(1, 1, 1) });
    const png = await pdf.embedPng(fs.readFileSync(imagePath));
    page.drawImage(png, { x: 0, y: imageY, width: imageW, height: imageH });
  }
  fs.writeFileSync(outputPath, await pdf.save());
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: edge });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const allImages = [];
  const report = [];

  for (const item of days) {
    await page.goto(pathToFileURL(item.html).href, { waitUntil: "load" });
    await page.addStyleTag({ content: exportCss });
    const count = await page.locator(".slide").count();
    const dayImages = [];
    for (let i = 0; i < count; i += 1) {
      await page.evaluate((index) => {
        document.body.classList.remove("show-notes", "presenter");
        document.querySelectorAll(".slide").forEach((slide, slideIndex) => {
          slide.classList.toggle("active", slideIndex === index);
        });
      }, i);
      await page.waitForTimeout(20);
      const metrics = await page.locator(".slide.active").evaluate((el) => ({
        title: el.dataset.title || "",
        widthOverflow: el.scrollWidth - el.clientWidth,
        heightOverflow: el.scrollHeight - el.clientHeight,
      }));
      const imagePath = path.join(shots, `day${item.day}-${String(i + 1).padStart(2, "0")}.png`);
      await page.locator(".deck").screenshot({ path: imagePath });
      dayImages.push(imagePath);
      allImages.push(imagePath);
      report.push({ day: item.day, slide: i + 1, ...metrics });
    }
    await makePdf(dayImages, path.join(deliverables, `AI_Workshop_Day_${item.day}_Slides_A4_Landscape.pdf`));
  }

  await makePdf(allImages, path.join(deliverables, "AI_Workshop_Days_1_to_6_Complete_A4_Landscape.pdf"));
  fs.copyFileSync(path.join(root, "day5", "index.html"), path.join(deliverables, "AI_Workshop_Day_5_Safe_and_Responsible_AI.html"));
  fs.copyFileSync(path.join(root, "day6", "index.html"), path.join(deliverables, "AI_Workshop_Day_6_Proposals_and_Editable_Documents.html"));
  fs.writeFileSync(path.join(work, "render-report.json"), JSON.stringify(report, null, 2));
  await browser.close();

  const overflow = report.filter((x) => x.widthOverflow > 1 || x.heightOverflow > 1);
  console.log(`Rendered ${report.length} slides. Overflow flags: ${overflow.length}`);
  if (overflow.length) console.log(JSON.stringify(overflow, null, 2));
})();
