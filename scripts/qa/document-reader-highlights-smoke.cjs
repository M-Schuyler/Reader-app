const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("playwright");

const baseUrl = process.env.QA_BASE_URL ?? "http://localhost:3061";
const executablePath =
  process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const screenshotPath =
  process.env.QA_SCREENSHOT_PATH ??
  path.resolve(process.cwd(), ".qa-artifacts", "document-reader-highlights-smoke.png");
const storePath = path.resolve(process.cwd(), ".qa-artifacts", "highlights-document-store.json");

async function main() {
  await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
  await fs.rm(storePath, { force: true });

  const browser = await chromium.launch({
    executablePath,
    headless: true,
  });

  const page = await browser.newPage({
    viewport: {
      width: 1440,
      height: 1280,
    },
  });

  try {
    await page.goto(`${baseUrl}/qa/documents/highlights`, {
      waitUntil: "networkidle",
    });

    await page.waitForSelector("text=Reader keeps reading traces stable.");

    await page.evaluate(() => {
      const paragraph = document.querySelector(".reader-rich-content p");
      if (!paragraph) {
        throw new Error("DocumentReader paragraph not found.");
      }

      const leadingText = paragraph.childNodes[0];
      const trailingText = paragraph.childNodes[2];

      if (!leadingText || !trailingText) {
        throw new Error("Expected inline text nodes around the strong tag.");
      }

      const range = document.createRange();
      range.setStart(leadingText, "Reader ".length);
      range.setEnd(trailingText, " intact".length);

      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);

      paragraph.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    });

    await page.getByRole("button", { name: "Save highlight" }).waitFor();
    const previewText = await page.locator("text=Save this passage to your reading traces.").textContent().catch(() => null);

    await page.getByRole("button", { name: "Save highlight" }).click();
    await page.waitForSelector("text=keeps structure intact");

    const textarea = page.getByPlaceholder("Add a short note");
    await textarea.fill("Reader page smoke note.");
    await page.getByRole("button", { name: "Save note" }).click();

    await page.reload({ waitUntil: "networkidle" });

    await page.waitForSelector("text=Reader keeps reading traces stable.");
    await page.waitForSelector("text=keeps structure intact");
    await assertTextareaValue(page, "Reader page smoke note.");

    const highlightCount = await page.locator("mark[data-highlight-id]").count();
    assert.equal(highlightCount > 0, true, "Expected a rendered highlight on the Reader page.");

    const sourceText = await page.locator("text=reader.local/qa/highlights-document").count();
    assert.equal(sourceText > 0, true, "Expected the fixture source URL to render in the Reader sidebar.");

    await page.screenshot({ path: screenshotPath, fullPage: true });

    await page.getByRole("button", { name: "Delete" }).click();
    await page.waitForSelector("text=No highlights yet. Select a passage in the reader to save the first one.");

    console.log(
      JSON.stringify(
        {
          ok: true,
          screenshotPath,
          selectionPreview: previewText,
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function assertTextareaValue(page, expectedValue) {
  const actual = await page.getByPlaceholder("Add a short note").inputValue();
  assert.equal(actual, expectedValue, "Expected highlight note to persist after reload.");
}
