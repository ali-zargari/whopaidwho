import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { outsideOverview } from "../src/lib/influence";
import { GET as politicians } from "../src/app/api/politicians/route";
import { GET as exportCsv } from "../src/app/api/export/route";

const cycle = 2026;
const reportedId = "H0AL01055";
const noSpendingId = "H0AL01097";

test("outside overview retains reported, zero, and unavailable values distinctly", async () => {
  const overview = await outsideOverview(
    [reportedId, noSpendingId, "H9ZZ99999"],
    cycle,
  );
  assert.match(overview.outsideDownloadedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(overview.outside[reportedId].status, "reported");
  assert.equal(typeof overview.outside[reportedId].support, "number");
  assert.equal(overview.outside[noSpendingId].status, "no-reported-spending");
  assert.equal(overview.outside[noSpendingId].support, 0);
  assert.equal(overview.outside["H9ZZ99999"].status, "not-indexed");
  assert.equal(overview.outside["H9ZZ99999"].support, null);
  assert.match(
    overview.outside[reportedId].sourceUrl,
    new RegExp(`candidate_id=${reportedId}`),
  );
});

test("politicians API and CSV export expose the same factual outside summary", async () => {
  const query = `cycle=${cycle}&q=${reportedId}&sort=receipts`;
  const apiResponse = await politicians(
    new NextRequest(`http://localhost/api/politicians?${query}`),
  );
  const body = await apiResponse.json();
  assert.equal(body.candidates.length, 1);
  assert.equal(body.candidates[0].id, reportedId);
  assert.equal(body.outside[reportedId].status, "reported");
  assert.equal(typeof body.outside[reportedId].oppose, "number");
  assert.match(body.outsideDownloadedAt, /^\d{4}-\d{2}-\d{2}T/);

  const csvResponse = await exportCsv(
    new NextRequest(`http://localhost/api/export?${query}`),
  );
  const [header, row] = (await csvResponse.text()).trim().split("\r\n");
  assert.match(header, /outside_spending_status/);
  assert.match(header, /outside_downloaded_at/);
  assert.match(row, /reported/);
  assert.match(row, new RegExp(`candidate_id=${reportedId}`));
});
