import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", "Demo1234!");
  await page.click('button[type="submit"]');
  await page.waitForURL(/requisitions|portal/);
}

test("recruiter to client to pipeline, end to end", async ({ browser }) => {
  const title = `E2E Java ${Date.now()}`;
  const recruiter = await (await browser.newContext()).newPage();

  // 1. JD -> scorecard -> edit weight -> save
  await login(recruiter, "recruiter@meridian.example");
  await recruiter.goto("/requisitions/new");
  await recruiter.click("text=Use sample JD");
  await recruiter.click("text=Extract scorecard");
  await expect(recruiter.getByText(/Weights total/)).toBeVisible();
  await recruiter.fill("#title", title);
  await recruiter.selectOption("#client", { label: "Ashford Bank" });
  await recruiter.getByLabel("Java weight").first().fill("30");
  await expect(recruiter.getByText(/Weights total \d+%/)).toBeVisible();
  await recruiter.getByRole("button", { name: "Normalise" }).click();
  await expect(recruiter.getByText("Weights total 100%")).toBeVisible();
  await recruiter.getByRole("button", { name: "Save requisition" }).click();
  await recruiter.waitForURL(/\/upload$/);

  // 2. upload 3 sample CVs and wait for processing
  await recruiter.getByLabel(/I confirm each candidate has consented/).check();
  await recruiter.getByRole("button", { name: "Try 3 sample CVs" }).click();
  await expect(recruiter.getByText("3 total")).toBeVisible();
  await expect(recruiter.getByText(/\b[12] ready|\b3 ready/)).toBeVisible({ timeout: 60_000 });
  await expect(recruiter.getByText("Reading CVs. Keep this page open")).toHaveCount(0, { timeout: 60_000 });
  await recruiter.getByRole("link", { name: "View ranked list" }).click();

  // 3. ranked list with evidence; submit is blocked until the CV is opened
  const row = recruiter.getByRole("row", { name: /Ritika Bansal/ });
  await expect(row).toBeVisible();
  await expect(row.getByText(/“.+”/)).toBeVisible();
  await row.getByRole("button", { name: "Open" }).click();
  const submit = recruiter.getByRole("dialog").getByRole("button", { name: "Submit to client" });
  await expect(submit).toBeDisabled();
  await recruiter.getByRole("tab", { name: "Resume" }).click();
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(recruiter.getByText("Submitted to the client").first()).toBeVisible();

  // 4. client sees only that candidate, masked, and shortlists
  const client = await (await browser.newContext()).newPage();
  await login(client, "hiring@ashfordbank.example");
  await client.getByText(title).locator("xpath=ancestor::li").getByRole("link", { name: "Review shortlist" }).click();
  await expect(client.getByText("Ritika Bansal")).toBeVisible();
  await expect(client.getByText("Pooja Nair")).toHaveCount(0);
  await expect(client.getByText(/r•••@e•••\.com/)).toBeVisible();
  await client.getByRole("button", { name: "Shortlist", exact: true }).click();
  await expect(client.getByText("You shortlisted this candidate")).toBeVisible();

  // 5. recruiter sees the decision in the pipeline
  await recruiter.goto(recruiter.url().split("?")[0] + "/pipeline");
  await expect(recruiter.getByText("Client shortlisted")).toBeVisible();
});

test("client on a phone: no horizontal scroll, actions reachable", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const page = await ctx.newPage();
  await login(page, "hiring@ashfordbank.example");
  await page.getByRole("link", { name: "Review shortlist" }).first().click();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  const box = await page.getByRole("button", { name: "View CV" }).first().boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(40);
});

test("a client cannot open recruiter screens or another client's data", async ({ browser }) => {
  const page = await (await browser.newContext()).newPage();
  await login(page, "hiring@velaretail.example");
  await page.goto("/requisitions");
  await expect(page).toHaveURL(/\/portal$/);
  const res = await page.request.get("/api/metrics");
  expect(res.status()).toBe(404);
});
