import test from "node:test";
import assert from "node:assert/strict";
import {
  CYCLES,
  DEFAULT_CYCLE,
  snapshot,
  getCandidate,
  parseFilters,
  searchCandidates,
  filteredCandidates,
} from "../src/lib/data";
import {
  currentCycle,
  officeLabel,
  contributionTotal,
  money,
} from "../src/lib/format";
import { committeeRecords } from "../src/lib/records";
import { csvCell } from "../src/lib/csv";

test("calendar years map to the correct two-year reporting period", () => {
  assert.equal(currentCycle(2025), 2026);
  assert.equal(currentCycle(2026), 2026);
  assert.equal(currentCycle(2027), 2028);
});
test("invalid filters are bounded and unsupported snapshots cannot silently fall back", () => {
  const f = parseFilters(
    new URLSearchParams(
      "cycle=9999&page=Infinity&sort=toString&party=hack&state=XX",
    ),
  );
  assert.equal(f.cycle, DEFAULT_CYCLE);
  assert.equal(f.sort, "receipts");
  assert.equal(f.state, "");
  assert.equal(f.page, 10000);
  assert.throws(() => snapshot(9999), RangeError);
});
test("all imported records retain valid IDs, cycles, unique identity and finite money", () => {
  for (const cycle of CYCLES) {
    const d = snapshot(cycle);
    assert.ok(d.candidates.length > 500);
    assert.equal(
      new Set(d.candidates.map((c) => c.id)).size,
      d.candidates.length,
    );
    assert.match(d.sha256, /^[a-f0-9]{64}$/);
    for (const c of d.candidates) {
      assert.equal(c.cycle, cycle);
      assert.match(c.id, /^[HS][A-Z0-9]{8}$/);
      for (const value of [
        c.receipts,
        c.cash,
        c.individuals,
        c.committees,
        c.debt,
      ])
        assert.ok(Number.isFinite(value));
      if (c.itemized !== null && c.unitemized !== null)
        assert.ok(Math.abs(c.itemized + c.unitemized - c.individuals) < 0.02);
    }
  }
});
test("search intersects state, chamber, party and free text and honors pagination", () => {
  const f = parseFilters(
    new URLSearchParams(
      "cycle=2024&q=sanders&office=senate&state=VT&party=IND",
    ),
  );
  const r = searchCandidates(f);
  assert.equal(r.total, 1);
  assert.equal(r.candidates[0].id, "S4VT00033");
  const pages = searchCandidates({
    ...f,
    q: "",
    state: "",
    office: "",
    party: "",
    page: 9999,
  });
  assert.equal(pages.page, pages.pages);
  assert.ok(pages.candidates.length <= 24);
});
test("source-verified Sanders 2024 financials preserve cents and gross categories", () => {
  const c = getCandidate("S4VT00033", 2024)!;
  assert.equal(c.receipts, 8207886.33);
  assert.equal(c.individuals, 7241250.56);
  assert.equal(c.committees, 89133.06);
  assert.equal(c.coverageEnd, "2024-12-31");
  assert.ok(Math.abs(contributionTotal(c) - 7330383.62) < 0.01);
  assert.equal(money(c.committees), "$89,133.06");
});
test("zero, negative corrections and absent districts are not silently rewritten", () => {
  const c = getCandidate("H6FL01119", 2026)!;
  assert.equal(c.individuals, -82.02);
  assert.ok(contributionTotal(c) < 0);
  assert.match(officeLabel({ ...c, district: "" }), /not reported/);
});
test("sorting is stable, numeric and does not mutate source data", () => {
  const f = parseFilters(new URLSearchParams("cycle=2026&sort=committees"));
  const all = filteredCandidates(f);
  assert.ok(
    all.every((c, i) => i === 0 || all[i - 1].committees >= c.committees),
  );
  assert.equal(snapshot(2026).candidates[0].id, "S8GA00180");
});
test("committee records are bounded, tied to cycle, never combined into totals", async () => {
  const r = await committeeRecords("S4VT00033", 2024);
  assert.ok(r.records.length > 0 && r.records.length <= 12);
  assert.equal(
    new Set(r.records.map((r) => r.committeeId)).size,
    r.records.length,
  );
  for (const row of r.records) {
    assert.ok(row.date >= "2023-01-01" && row.date <= "2024-12-31");
    assert.ok(["24K", "24Z"].includes(row.type));
    assert.match(row.fileNumber, /^\d+$/);
  }
  await assert.rejects(committeeRecords("S4VT00033", 9999), RangeError);
});
test("CSV preserves real negative numbers and neutralizes untrusted formula text", () => {
  assert.equal(csvCell(-82.02), "-82.02");
  assert.equal(csvCell("=1+1"), '"\'=1+1"');
  assert.equal(csvCell(" @SUM(A1)"), '"\' @SUM(A1)"');
  assert.equal(csvCell('Jones, "Jane"'), '"Jones, ""Jane"""');
});

test("race groups use election registrations rather than all financial activity", () => {
  for (const cycle of CYCLES) {
    const registrations = snapshot(cycle).registrations;
    assert.ok(registrations.length > 500);
    assert.equal(
      new Set(registrations.map((r) => r.id)).size,
      registrations.length,
    );
    assert.ok(
      registrations.every((r) => r.electionYear === cycle && r.status === "C"),
    );
  }
  assert.ok(getCandidate("S4VT00033", 2026));
  assert.ok(!snapshot(2026).registrations.some((r) => r.id === "S4VT00033"));
  assert.ok(snapshot(2024).registrations.some((r) => r.id === "S4VT00033"));
});
test("corporate PAC and outside spending records preserve different relationships", async () => {
  for (const cycle of CYCLES) {
    const r = await committeeRecords("H2CA14162", cycle);
    assert.ok(r.corporateRecords.length > 0);
    assert.ok(r.corporateRecords.length <= 8);
    assert.equal(
      new Set(r.corporateRecords.map((x) => x.committeeId)).size,
      r.corporateRecords.length,
    );
    for (const row of r.corporateRecords) {
      assert.equal(row.organizationType, "C");
      assert.ok(row.connectedOrganization);
      assert.ok(["24K", "24Z"].includes(row.type));
      assert.ok(
        row.date >= `${cycle - 1}-01-01` && row.date <= `${cycle}-12-31`,
      );
    }
    assert.ok(r.outsideRecords.length <= 8);
    for (const row of r.outsideRecords) {
      assert.equal(row.stance, row.type === "24E" ? "support" : "oppose");
      assert.ok(["24E", "24A"].includes(row.type));
      assert.ok(Number.isFinite(row.amount));
      assert.match(row.fileNumber, /^\d+$/);
    }
  }
});

import { usableExample } from "../src/lib/record-examples";
test("voided, zero and refunded examples cannot become a positive graph edge", () => {
  assert.equal(usableExample({ amount: -1000, memo: "REFUND" }), false);
  assert.equal(usableExample({ amount: 0, memo: null }), false);
  assert.equal(
    usableExample({ amount: 2000, memo: "VOID CHECK ORIGINALLY DATED 6/4/26" }),
    false,
  );
  assert.equal(usableExample({ amount: 1000, memo: null }), true);
});

test("coverage dates after retrieval are flagged without altering FEC source values", () => {
  for (const cycle of CYCLES) {
    const data = snapshot(cycle);
    for (const c of data.candidates)
      assert.equal(
        c.coverageDateAnomaly,
        !!c.coverageEnd && c.coverageEnd > data.downloadedAt.slice(0, 10),
      );
  }
});
