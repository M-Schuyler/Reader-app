const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("playwright");

const baseUrl = process.env.QA_BASE_URL ?? "http://localhost:3061";
const executablePath =
  process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const screenshotPath =
  process.env.QA_SCREENSHOT_PATH ??
  path.resolve(process.cwd(), ".qa-artifacts", "highlights-browser-smoke.png");

async function main() {
  await fs.mkdir(path.dirname(screenshotPath), { recursive: true });

  const browser = await chromium.launch({
    executablePath,
    headless: true,
  });

  const page = await browser.newPage({
    viewport: {
      width: 1440,
      height: 1180,
    },
  });

  try {
    await page.goto(`${baseUrl}/qa/highlights`, {
      waitUntil: "networkidle",
    });

    await page.waitForSelector("text=Highlights lab");

    await page.evaluate(() => {
      const paragraph = document.querySelector("[data-qa='highlight-content'] p");
      if (!paragraph) {
        throw new Error("Inline sample paragraph not found.");
      }

      const leadingText = paragraph.childNodes[0];
      const trailingText = paragraph.childNodes[2];

      if (!leadingText || !trailingText) {
        throw new Error("Expected text nodes around the inline emphasis.");
      }

      const range = document.createRange();
      range.setStart(leadingText, "Reader ".length);
      range.setEnd(trailingText, " intact".length);

      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);

      paragraph.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    });

    await page.waitForSelector("[data-qa='selection-preview']");
    const previewText = await page.locator("[data-qa='selection-preview']").textContent();
    assert.equal(
      previewText?.includes("keeps structure intact"),
      true,
      "Expected selection preview to preserve inline whitespace.",
    );

    await page.locator("[data-qa='save-highlight']").click();
    await page.waitForSelector("text=keeps structure intact");

    const textarea = page.getByPlaceholder("Add a short note");
    await textarea.fill("Whitespace and offsets stay aligned.");
    await page.getByRole("button", { name: "Save note" }).click();

    await page.reload({ waitUntil: "networkidle" });

    await page.waitForSelector("text=Highlights lab");
    await page.waitForSelector("text=keeps structure intact");

    const noteValue = await page.getByPlaceholder("Add a short note").inputValue();
    assert.equal(noteValue, "Whitespace and offsets stay aligned.");

    const highlightCount = await page.locator("mark[data-highlight-id]").count();
    assert.equal(highlightCount > 0, true, "Expected rendered highlight marks.");

    const renderedText = await page.locator("[data-qa='highlight-content']").textContent();
    assert.equal(
      renderedText?.includes("Reader keeps structure intact across inline passages"),
      true,
      "Expected inline spacing to remain visible in rendered content.",
    );

    await page.screenshot({ path: screenshotPath, fullPage: true });

    await page.getByRole("button", { name: "Reset saved traces" }).click();
    await page.waitForSelector("text=No highlights yet. Select a passage in the reader to save the first one.");

    console.log(
      JSON.stringify(
        {
          ok: true,
          screenshotPath,
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
