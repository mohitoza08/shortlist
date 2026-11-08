/** Captures desktop + mobile screenshots into docs/screenshots. Needs a running app: npm run screenshots */
import { chromium, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const out = path.join(process.cwd(), "docs", "screenshots");
fs.mkdirSync(out, { recursive: true });

async function login(page: Page, email: string) {
  await page.goto(`${base}/login`);
  await page.fill("#email", email);
  await page.fill("#password", "Demo1234!");
  await page.click('button[type="submit"]');
  await page.waitForURL(/requisitions|portal/);
}

(async () => {
  const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL as "chrome" } : {});
  const desk = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const page = await desk.newPage();

  await page.goto(`${base}/login`);
  await page.waitForTimeout(1400);
  await page.screenshot({ path: path.join(out, "01-login.png") });

  await login(page, "recruiter@meridian.example");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1400);
  await page.screenshot({ path: path.join(out, "02-requisitions.png"), fullPage: true });

  await page.goto(`${base}/requisitions/new`);
  await page.click("text=Use sample JD");
  await page.click("text=Extract scorecard");
  await page.waitForSelector("text=Weights total");
  await page.selectOption("#client", { label: "Ashford Bank" });
  await page.waitForTimeout(1400);
  await page.screenshot({ path: path.join(out, "03-new-requisition.png"), fullPage: true });

  const javaHref = await page.goto(`${base}/requisitions`).then(() => page.getByRole("link", { name: "Senior Java Developer" }).first().getAttribute("href"));
  const reqId = javaHref!.split("/").pop()!;
  await page.goto(`${base}/requisitions/${reqId}/upload`);
  await page.waitForTimeout(1400);
  await page.screenshot({ path: path.join(out, "04-upload.png"), fullPage: true });

  await page.goto(`${base}/requisitions/${reqId}`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1400);
  await page.screenshot({ path: path.join(out, "05-ranked.png"), fullPage: true });

  const first = page.getByRole("button", { name: "Open" }).first();
  await first.click();
  await page.waitForSelector("text=Overview");
  await page.getByRole("tab", { name: "Scorecard" }).click();
  await page.waitForTimeout(400);
  await page.waitForTimeout(1400);
  await page.screenshot({ path: path.join(out, "06-drawer-scorecard.png") });

  await page.goto(`${base}/requisitions/${reqId}/pipeline`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1400);
  await page.screenshot({ path: path.join(out, "07-pipeline.png"), fullPage: true });

  await page.goto(`${base}/requisitions?tab=fairness`);
  await page.waitForTimeout(1400);
  await page.screenshot({ path: path.join(out, "08-fairness.png"), fullPage: true });

  // Client on a phone
  const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, reducedMotion: "reduce" });
  const m = await mob.newPage();
  await login(m, "hiring@ashfordbank.example");
  await m.waitForTimeout(1400);
  await m.screenshot({ path: path.join(out, "09-portal-mobile.png"), fullPage: true });
  await m.getByRole("link", { name: "Review shortlist" }).first().click();
  await m.waitForLoadState("networkidle");
  await m.waitForTimeout(1400);
  await m.screenshot({ path: path.join(out, "10-portal-review-mobile.png"), fullPage: true });
  const overflow = await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  console.log("mobile horizontal overflow:", overflow);

  await browser.close();
  console.log("Screenshots written to", out);
})();
