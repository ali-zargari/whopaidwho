import { test, expect } from "@playwright/test";

test("uniform enforcement search links campaign respondents and source documents", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/accountability?cycle=2024");
  await expect(page.locator(".accountability-scope")).toContainText(
    "5,759 candidate IDs checked",
  );
  await page
    .getByLabel("Candidate, committee or case number")
    .fill("H8TX02166");
  await page
    .getByRole("button", { name: "Search records", exact: true })
    .click();
  await expect(page.locator(".enforcement-record")).toHaveCount(1);
  await expect(page.locator(".enforcement-record")).toContainText("MUR 8030");
  await expect(page.locator(".enforcement-outcomes")).toContainText(
    "$42,000.00",
  );
  await expect(page.locator(".enforcement-outcomes")).toContainText(
    "Kilgore, Paul",
  );
  await page
    .getByText("Read the decision and source documents", { exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: /Conciliation and Settlement Agreements/ }),
  ).toHaveAttribute("href", /fec.gov\/files\/legal\/murs\/8030\//);
  await page
    .locator(".enforcement-match")
    .getByRole("link", { name: /Daniel Crenshaw/ })
    .click();
  await expect(page).toHaveURL(
    /candidate\/H8TX02166\?cycle=2024#accountability/,
  );
  await expect(
    page.getByRole("heading", { name: "Accountability record", exact: true }),
  ).toBeVisible();
  await page.goto("/candidate/H2IL01281?cycle=2024#accountability");
  await expect(
    page.locator(".enforcement-record").filter({ hasText: "MUR 8285" }),
  ).toContainText("$10,000.00");
  await expect(page.locator(".enforcement-match").first()).toContainText(
    /Pat Dowell for Congress/i,
  );
  expect(errors).toEqual([]);
});

test("reviewed allegations, findings and later outcomes remain distinct and searchable", async ({
  page,
}) => {
  await page.goto("/accountability?view=reviewed");
  await page
    .getByLabel("Record status", { exact: true })
    .selectOption("investigation");
  await page
    .getByRole("button", { name: "Search records", exact: true })
    .click();
  await expect(page.locator(".case-card")).toHaveCount(1);
  await expect(page.locator(".case-card")).toContainText("Cory Mills");
  await expect(page.locator(".case-context")).toContainText("not a finding");
  await page.goto("/accountability?view=reviewed&q=Met+Gala");
  await expect(page.locator(".case-card")).toHaveCount(1);
  await expect(page.locator(".case-card")).toContainText(
    "Alexandria Ocasio-Cortez",
  );
  await expect(page.locator(".case-context")).toContainText(
    "no evidence she intentionally underpaid",
  );
  await page.goto("/accountability?view=reviewed&q=Santos");
  await expect(page.locator(".case-outcome")).toContainText("commutation");
  await expect(page.locator(".case-outcome")).toContainText(
    "no further fines, restitution",
  );
  await page.goto("/accountability?view=reviewed&status=dismissed");
  await expect(page.locator(".case-card")).toContainText(
    "did not result in a violation finding",
  );
  await page.goto("/accountability?q=zzzznobody");
  await expect(page.locator(".empty-state")).toContainText(
    "not a finding of no misconduct",
  );
});

test("accountability coverage, grouped penalties, comparison and mobile layouts remain accurate", async ({
  page,
}) => {
  await page.goto("/accountability?q=7455");
  await expect(page.locator(".enforcement-amount")).toHaveCount(1);
  await expect(page.locator(".enforcement-record")).toContainText(
    "Joint action references",
  );
  await expect(page.locator(".enforcement-outcomes")).toContainText(
    "Conciliation: Pre Probable Cause",
  );
  await expect(page.locator(".enforcement-outcomes")).toContainText(
    "Reason to Believe Finding",
  );
  await page.goto("/accountability?q=7923");
  await expect(page.locator(".enforcement-outcomes")).not.toContainText(
    "$7,500",
  );
  for (const path of [
    "/accountability",
    "/accountability?view=reviewed",
    "/candidate/H8TX02166?cycle=2024",
    "/candidate/H4NC02192?cycle=2026",
    "/compare?cycle=2024&ids=H8TX02166,H2IL01281",
  ]) {
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth + 1,
      ),
      path,
    ).toBeTruthy();
  }
  await expect(
    page.locator(".comparison-table .accountability-badge"),
  ).toHaveCount(2);
  await expect(page.locator(".comparison-table")).toContainText(
    "Penalty listed in source",
  );
  await page.goto("/candidate/H4NC02192?cycle=2026#accountability");
  await expect(page.locator(".accountability-panel")).toContainText(
    "No match is not a clean bill of health",
  );
  await page.goto("/methodology#accountability");
  await expect(
    page.getByRole("heading", {
      name: "Document the conduct. Include the outcome.",
    }),
  ).toBeVisible();
});
