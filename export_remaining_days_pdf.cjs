const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { chromium } = require("C:/Users/paraj/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright");
const { PDFDocument, rgb } = require("C:/Users/paraj/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/pdf-lib@1.17.1/node_modules/pdf-lib");

const root = "C:/ai";
const work = path.join(root, "outputs", "remaining-html-pdf-export");
const shots = path.join(work, "slides");
const deliverables = path.join(root, "deliverables");
const edge = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const days = [7, 8, 9].map((day) => ({
  day,
  html: path.join(root, `day${day}`, "index.html"),
  pdf: path.join(deliverables, `AI_Workshop_Day_${day}_Slides_A4_Landscape.pdf`),
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

async function combinePdfs(inputPaths, outputPath) {
  const combined = await PDFDocument.create();
  for (const inputPath of inputPaths) {
    const source = await PDFDocument.load(fs.readFileSync(inputPath));
    const pages = await combined.copyPages(source, source.getPageIndices());
    pages.forEach((page) => combined.addPage(page));
  }
  fs.writeFileSync(outputPath, await combined.save());
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: edge });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
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
      report.push({ day: item.day, slide: i + 1, ...metrics });
    }

    await makePdf(dayImages, item.pdf);
  }

  await browser.close();

  await combinePdfs(
    [
      path.join(deliverables, "AI_Workshop_Days_1_to_6_Complete_A4_Landscape.pdf"),
      ...days.map((item) => item.pdf),
    ],
    path.join(deliverables, "AI_Workshop_Days_1_to_9_Complete_A4_Landscape.pdf"),
  );

  fs.writeFileSync(path.join(work, "render-report.json"), JSON.stringify(report, null, 2));
  const overflow = report.filter((item) => item.widthOverflow > 1 || item.heightOverflow > 1);
  console.log(`Rendered ${report.length} slides. Overflow flags: ${overflow.length}`);
  if (overflow.length) console.log(JSON.stringify(overflow, null, 2));
})();
