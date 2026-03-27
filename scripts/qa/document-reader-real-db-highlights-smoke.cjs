const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("playwright");

const baseUrl = process.env.QA_BASE_URL ?? "http://localhost:3061";
const executablePath =
  process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const screenshotPath =
  process.env.QA_SCREENSHOT_PATH ??
  path.resolve(process.cwd(), ".qa-artifacts", "document-reader-real-db-highlights-smoke.png");

async function main() {
  await fs.mkdir(path.dirname(screenshotPath), { recursive: true });

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
    await page.goto(`${baseUrl}/qa/documents/highlights/real`, {
      waitUntil: "networkidle",
    });

    await page.waitForSelector("text=Running against a real local document.");
    await page.waitForSelector("h1");

    await page.evaluate(() => {
      const candidate =
        document.querySelector(".reader-rich-content p, .reader-rich-content blockquote, .reader-rich-content li") ??
        document.querySelector(".reader-rich-content");

      if (!candidate) {
        throw new Error("No readable content block found for selection.");
      }

      const walker = document.createTreeWalker(candidate, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          return node.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        },
      });

      const textNodes = [];
      while (walker.nextNode()) {
        textNodes.push(walker.currentNode);
      }

      if (textNodes.length === 0) {
        throw new Error("No text nodes found inside the real document content.");
      }

      const startNode = textNodes[0];
      const endNode = textNodes[Math.min(1, textNodes.length - 1)];
      const startOffset = Math.min(5, Math.max(0, (startNode.textContent?.length ?? 0) - 2));
      const endOffset = Math.min(
        Math.max(startOffset + 8, 16),
        endNode.textContent?.length ?? 0,
      );

      const range = document.createRange();
      range.setStart(startNode, startOffset);
      range.setEnd(endNode, endOffset);

      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);

      candidate.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    });

    await page.getByRole("button", { name: "Save highlight" }).waitFor();
    await page.getByRole("button", { name: "Save highlight" }).click();

    const textarea = page.getByPlaceholder("Add a short note");
    await textarea.fill("Real DB smoke note.");
    await Promise.all([
      page.waitForResponse((response) => {
        return response.request().method() === "PATCH" && response.url().includes("/api/highlights/");
      }),
      page.getByRole("button", { name: "Save note" }).click(),
    ]);

    await page.reload({ waitUntil: "networkidle" });

    await page.waitForSelector("text=Running against a real local document.");
    await page.waitForSelector("mark[data-highlight-id]");
    await assertTextareaValue(page, "Real DB smoke note.");

    const actualDocumentId = await page.locator("span.font-mono").textContent();
    assert.equal(Boolean(actualDocumentId?.trim()), true, "Expected the QA page to disclose the real document id.");

    await page.screenshot({ path: screenshotPath, fullPage: true });

    await page.getByRole("button", { name: "Delete" }).click();
    await page.waitForSelector("text=No highlights yet. Select a passage in the reader to save the first one.");

    console.log(
      JSON.stringify(
        {
          ok: true,
          screenshotPath,
          actualDocumentId,
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
  assert.equal(actual, expectedValue, "Expected real DB highlight note to persist after reload.");
}
