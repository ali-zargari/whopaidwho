import { test, expect } from "@playwright/test";

test("outside graph, nonprofit funding links and donor affiliations have inspectable evidence", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/candidate/S6OH00163?cycle=2024");
  const outside = page.getByRole("region", {
    name: "The outside money",
    exact: true,
  });
  await expect(outside).toContainText("$115,071,914.82");
  await outside.getByRole("button", { name: /SENATE LEADERSHIP FUND/ }).click();
  await expect(
    page.getByRole("region", { name: "Selected outside spender" }),
  ).toContainText("SENATE LEADERSHIP FUND");
  await expect(
    page.getByRole("link", { name: "Inspect this group’s spending" }),
  ).toHaveAttribute("href", /committee_id=C00571703/);
  const path = page
    .locator(".funding-path")
    .filter({
      has: page.locator("summary > span > strong", {
        hasText: /^SENATE LEADERSHIP FUND$/,
      }),
    });
  await path.locator(":scope > summary").click();
  const nonprofit = path
    .locator(".upstream-donor")
    .filter({
      has: page.getByRole("heading", { name: "ONE NATION", exact: true }),
    });
  await expect(nonprofit).toContainText("501(c)(4)");
  await expect(nonprofit).toContainText("not attributed to this candidate");
  await expect(
    nonprofit.getByRole("link", { name: /IRS source/ }).first(),
  ).toHaveAttribute("href", /irs.gov/);
  await expect(page.locator("#donor-affiliations")).toContainText("CEO");
  await expect(page.locator("#donor-affiliations")).toContainText(
    "personal donations",
  );
  const response = await request.get("/api/influence?cid=S6OH00163&cycle=2024");
  expect(response.ok()).toBeTruthy();
  const data = await response.json();
  expect(data.outside.oppose).toBe(115071914.82);
  expect(data.outside.coverage.rapidNoticesIncluded).toBe(false);
  expect(data.outside.sourceAudit.scope).toContain("All federal");
  expect(errors).toEqual([]);
});

test("new-cycle candidates retain unknown historical coverage and downloads work", async ({
  page,
  request,
}) => {
  await page.goto(
    "/races/house-CA-02?cycle=2026&fundingCycle=2024&candidate=H0CA01205",
  );
  await expect(page.locator("#outside-spending")).toContainText("not indexed");
  await expect(page.locator("#funding-transparency")).toContainText(
    "coverage unavailable",
  );
  const response = await request.get("/api/influence?cid=H0CA01205&cycle=2024");
  expect(response.ok()).toBeTruthy();
  expect((await response.json()).outside.support).toBeNull();
  expect(
    (await request.get("/api/influence?cid=../secret&cycle=2024")).status(),
  ).toBe(400);
  expect(
    (await request.get("/api/influence?cid=S6OH00163&cycle=2028")).status(),
  ).toBe(400);
});

test("signed outside corrections, comparison and responsive expanded funding paths", async ({
  page,
}) => {
  await page.goto("/candidate/H8CA34266?cycle=2026");
  await expect(page.locator("#outside-spending")).toContainText("-$28,149.66");
  await expect(page.locator("#outside-spending")).toContainText(
    "negative amounts reflect reported adjustments",
  );
  await page.goto("/compare?cycle=2024&ids=S6OH00163,S4OH00192");
  await expect(page.locator(".comparison-table")).toContainText(
    "Outside spending supporting candidate",
  );
  await expect(page.locator(".comparison-table")).toContainText(
    "Outside spending snapshot retrieved",
  );
  await page.goto("/candidate/S6OH00163?cycle=2024");
  await page.locator(".funding-path > summary").first().click();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth + 1,
    ),
  ).toBeTruthy();
});
