import { test, expect } from "@playwright/test";
test("current-cycle explorer, filters, profile and source records", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Follow the money.",
  );
  await expect(page.getByLabel("Reporting cycle", { exact: true })).toHaveValue(
    "2026",
  );
  await page
    .getByLabel("Reporting cycle", { exact: true })
    .selectOption("2024");
  await page
    .getByRole("textbox", { name: "Search candidates" })
    .fill("Sanders");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByRole("radio", { name: "U.S. Senate", exact: true }).check();
  await page.getByLabel("State or territory").selectOption("VT");
  await expect(page.locator(".candidate-card")).toHaveCount(1);
  await page
    .getByRole("link", { name: "Bernard Sanders", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Bernard Sanders",
  );
  await expect(page.getByText("$89,133.06", { exact: true })).toBeVisible();
  await expect(page.locator(".records-table tbody tr").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "View on FEC" })).toHaveAttribute(
    "href",
    /S4VT00033.*cycle=2024/,
  );
  await expect(
    page.getByRole("link", { name: "Filing", exact: true }).first(),
  ).toHaveAttribute(
    "href",
    /https:\/\/www.fec.gov\/data\/filings\/\?file_number=\d+/,
  );
  expect(errors).toEqual([]);
});
test("comparison selection survives search and produces a shareable same-cycle table", async ({
  page,
}) => {
  await page.goto("/?cycle=2024&q=sanders");
  await page
    .getByRole("button", { name: "Compare Bernard Sanders", exact: true })
    .click();
  await page.getByRole("textbox", { name: "Search candidates" }).fill("warren");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByText("1 of 3 selected")).toBeVisible();
  await page.getByRole("button", { name: /Compare Elizabeth/ }).click();
  await page.getByRole("link", { name: "Compare funding" }).click();
  await expect(page).toHaveURL(/compare\?cycle=2024&ids=/);
  await expect(page.locator(".comparison-table")).toContainText(
    "Bernard Sanders",
  );
  await expect(page.locator(".comparison-table")).toContainText(
    "Elizabeth Warren",
  );
  await page.reload();
  await expect(page.locator(".comparison-table")).toContainText(
    "Bernard Sanders",
  );
  await expect(
    page
      .locator(".comparison-table tbody tr")
      .filter({ hasText: "Reported receipts" }),
  ).toContainText("$8,207,886.33");
});
test("comparison picker, remove, cycle switch and clear while searching", async ({
  page,
}) => {
  await page.goto("/compare?cycle=2024");
  await page.getByLabel("Add a candidate to compare").fill("Sanders");
  await page
    .locator(".picker-results")
    .getByRole("link", { name: /Bernard Sanders/ })
    .click();
  await expect(page.locator(".comparison-table")).toContainText(
    "Bernard Sanders",
  );
  await page.getByRole("link", { name: "Remove Bernard Sanders" }).click();
  await page.getByLabel("Add a candidate to compare").fill("war");
  await page.getByLabel("Add a candidate to compare").clear();
  await expect(page.getByText("Searching…", { exact: true })).toHaveCount(0);
  await page
    .getByLabel("Reporting cycle", { exact: true })
    .selectOption("2026");
  await expect(page).toHaveURL(/cycle=2026/);
});
test("empty state, negative adjustments, missing page, methodology and historical navigation", async ({
  page,
}) => {
  await page.goto("/?q=zzzznobody&cycle=2024");
  await expect(
    page.getByRole("heading", { name: "No candidates match these filters." }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Compare", exact: true })
    .click();
  await expect(page).toHaveURL(/cycle=2024/);
  await page.goto("/?q=H6FL01119&cycle=2026");
  await expect(
    page.getByText("Signed adjustments — see profile"),
  ).toBeVisible();
  await page.goto("/candidate/INVALID?cycle=2026");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "isn’t in the public record",
  );
  await page.goto("/methodology");
  await expect(
    page.getByRole("heading", {
      name: "A paper trail, not a donor leaderboard.",
    }),
  ).toBeVisible();
});
test("exports exactly the filtered records and APIs reject invalid input", async ({
  request,
}) => {
  const response = await request.get("/api/export?cycle=2024&q=S4VT00033");
  expect(response.ok()).toBeTruthy();
  expect(response.headers()["content-type"]).toContain("text/csv");
  const text = await response.text();
  expect(text).toContain("8207886.33");
  expect(text.trim().split("\r\n")).toHaveLength(2);
  expect(
    (await request.get("/api/donors?cid=../secret&cycle=2024")).status(),
  ).toBe(400);
  expect(
    (await request.get("/api/donors?cid=S4VT00033&cycle=2028")).status(),
  ).toBe(400);
  expect((await request.get("/api/politicians?cycle=2025")).status()).toBe(400);
  const records = await request.get("/api/donors?cid=S4VT00033&cycle=2024");
  expect(records.ok()).toBeTruthy();
  expect((await records.json()).records.length).toBeGreaterThan(0);
});
test("responsive pages avoid horizontal viewport overflow and keyboard can reach search", async ({
  page,
}) => {
  for (const path of [
    "/",
    "/candidate/S4VT00033?cycle=2024",
    "/compare?cycle=2024&ids=S4VT00033,S2MA00170",
    "/methodology",
  ]) {
    await page.goto(path);
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth + 1,
      ),
    ).toBeTruthy();
  }
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
});

test("race filters, branded graph, source inspection and historical funding cycle", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/races");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Every race has a money trail.",
  );
  await page.getByLabel("Race state", { exact: true }).selectOption("CA");
  await page.getByLabel("Race office", { exact: true }).selectOption("house");
  await expect(page).toHaveURL(/state=CA.*office=house/);
  await expect(page.locator(".race-card").first()).toContainText("California");
  await page.goto("/races/house-CA-15?cycle=2026&candidate=H2CA14162");
  await expect(
    page.getByRole("heading", { name: "Kevin Mullin’s funding map" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Google connected PAC/ }).click();
  await expect(
    page.getByRole("region", { name: "Selected PAC transaction" }),
  ).toContainText("GOOGLE");
  await expect(
    page.getByRole("link", { name: "Original filing", exact: true }),
  ).toHaveAttribute("href", /file_number=\d+/);
  await page.getByRole("tab", { name: "Table", exact: true }).click();
  await expect(page.getByRole("table").first()).toContainText("Individuals");
  await expect(page.locator(".dark-money-disclaimer")).toContainText(
    "Original donors: not determined",
  );
  await expect(
    page.locator(".outside-network .outside-group-node").first(),
  ).toBeVisible();
  await expect(page.locator(".dark-money-disclaimer")).toContainText(
    "not automatically dark money",
  );
  await page.getByLabel("Map funding cycle").selectOption("2024");
  await expect(page).toHaveURL(/candidate=H2CA14162.*fundingCycle=2024/);
  await expect(
    page.getByRole("heading", { name: "Kevin Mullin’s funding map" }),
  ).toBeVisible();
  await expect(page.locator(".map-key")).toContainText("Dec 31, 2024");
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth + 1,
    ),
  ).toBeTruthy();
  await page.getByRole("tab", { name: "Map", exact: true }).click();
  await page.locator(".funding-network").scrollIntoViewIfNeeded();
  expect(
    await page
      .locator(".graph-company-node img")
      .evaluateAll(async (images) => {
        await Promise.all(
          images.map((el) => (el as HTMLImageElement).decode()),
        );
        return images.every((el) => (el as HTMLImageElement).naturalWidth > 0);
      }),
  ).toBeTruthy();
  expect(errors).toEqual([]);
});
