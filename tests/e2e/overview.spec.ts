import { expect, test } from "@playwright/test";

test("the directory stays alphabetical and David Trone's card separates contributions from loans", async ({
  page,
  request,
}) => {
  const response = await request.get(
    "/api/politicians?cycle=2024&q=David%20Trone&sort=receipts",
  );
  expect(response.ok()).toBeTruthy();
  const data = await response.json();
  expect(data.candidates.map((candidate: { id: string }) => candidate.id)).toEqual([
    "H6MD08549",
    "S4MD00319",
  ]);

  const trone = data.candidates.find(
    (candidate: { id: string }) => candidate.id === "H6MD08549",
  );
  expect(trone).toMatchObject({
    individuals: 853811.58,
    committees: 5000,
    selfContributions: 0,
    partyContributions: 0,
    candidateLoans: 62877800,
    receipts: 63833136.59,
  });
  expect(data.outside.H6MD08549).toMatchObject({
    status: "no-reported-spending",
    support: 0,
    oppose: 0,
  });

  await page.goto("/?cycle=2024&q=David%20Trone&sort=receipts");
  await expect(page.getByText("Name A–Z", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Sort by")).toHaveCount(0);
  await expect(page.locator(".card-rank")).toHaveCount(0);

  const card = page
    .locator(".candidate-card")
    .filter({
      has: page.locator('a[href="/candidate/H6MD08549?cycle=2024"]'),
    });
  await expect(card).toContainText("Campaign receipts");
  await expect(card).toContainText("Individuals");
  await expect(card).toContainText("Political committees");
  await expect(card).toContainText("Candidate contributions");
  await expect(card).toContainText("Party committees");
  await expect(card).toContainText("99.4%");
  await expect(card).toContainText("Candidate loans");
  await expect(card).toContainText("$62.9M");
  await expect(card).toContainText(
    "No matching outside spending in this processed snapshot.",
  );
  await expect(card).not.toContainText("Not indexed");

  await card.getByText("Other receipts & exact amounts", { exact: true }).click();
  await expect(card).toContainText("$62,877,800");
  await expect(card).toContainText("Remaining receipts (calculated)");
  await expect(card).toContainText(
    "Percentages are of contributions only; loans and other receipts are excluded.",
  );
});

test("a search keeps the visible directory in the API's alphabetical order", async ({
  page,
  request,
}) => {
  const response = await request.get(
    "/api/politicians?cycle=2024&q=David&sort=receipts",
  );
  expect(response.ok()).toBeTruthy();
  const data = await response.json();
  const names = data.candidates.map((candidate: { name: string }) => candidate.name);
  expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));

  await page.goto("/?cycle=2024&q=David");
  await expect(page.locator(".candidate-card")).toHaveCount(names.length);
  await expect(page.locator(".candidate-card .candidate-title h3")).toHaveText(names);
  await expect(page.locator(".card-period")).toHaveCount(names.length);
});

test("outside totals retain their support and opposition labels with a cited source", async ({
  page,
  request,
}) => {
  const response = await request.get("/api/politicians?cycle=2024&q=S6OH00163");
  expect(response.ok()).toBeTruthy();
  const data = await response.json();
  expect(data.candidates).toHaveLength(1);
  expect(data.outside.S6OH00163).toMatchObject({
    status: "reported",
    support: 24295871.82,
    oppose: 115071914.82,
  });
  expect(data.outside.S6OH00163.sourceUrl).toMatch(
    /candidate_id=S6OH00163.*cycle=2024/,
  );
  expect(data.outsideDownloadedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

  await page.goto("/?cycle=2024&q=S6OH00163");
  const card = page.locator(".candidate-card");
  await expect(card).toContainText("Outside support");
  await expect(card).toContainText("Outside opposition");
  await expect(
    card.getByRole("link", { name: /Outside support: \$24,295,871\.82\. FEC source/ }),
  ).toHaveAttribute("href", /candidate_id=S6OH00163.*cycle=2024/);
  await expect(
    card.getByRole("link", { name: /Outside opposition: \$115,071,914\.82\. FEC source/ }),
  ).toHaveAttribute("href", /candidate_id=S6OH00163.*cycle=2024/);
  await expect(
    card.getByRole("link", { name: "FEC outside filings ↗" }),
  ).toHaveAttribute("href", /candidate_id=S6OH00163.*cycle=2024/);
  await expect(card).not.toContainText(/grassroots/i);
});

test("the overview card does not overflow on a phone", async ({ page }) => {
  await page.goto("/?cycle=2024&q=S6OH00163");
  await page
    .locator(".card-receipt-details")
    .getByText("Other receipts & exact amounts", { exact: true })
    .click();
  await page.evaluate(() => document.fonts.ready);
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth + 1,
    ),
  ).toBeTruthy();
});
