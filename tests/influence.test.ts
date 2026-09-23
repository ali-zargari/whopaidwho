import test from "node:test";
import assert from "node:assert/strict";
import { CYCLES, snapshot } from "../src/lib/data";
import {
  outsideSnapshot,
  affiliationSnapshot,
  fundingLinksSnapshot,
  candidateInfluence,
} from "../src/lib/influence";

const cents = (n: number) => Math.round(n * 100);
test("outside totals cover every profile and registration and reconcile by position", async () => {
  for (const cycle of CYCLES) {
    const data = await outsideSnapshot(cycle);
    assert.equal(data.coverage.nonCommitteeForm5Included, true);
    assert.equal(data.coverage.rapidNoticesIncluded, false);
    for (const c of [
      ...snapshot(cycle).candidates,
      ...snapshot(cycle).registrations,
    ])
      assert.ok(data.candidates[c.id], c.id);
    for (const candidate of Object.values(data.candidates)) {
      assert.ok(candidate);
      for (const side of ["support", "oppose"] as const) {
        assert.equal(
          cents(candidate[side]),
          candidate.spenders.reduce((sum, s) => sum + cents(s[side]), 0),
        );
      }
      assert.equal(
        new Set(candidate.spenders.map((s) => s.id)).size,
        candidate.spenders.length,
      );
      if (candidate.status === "no-reported-spending")
        assert.equal(candidate.spenders.length, 0);
    }
  }
});
test("source-checked Form 5 spending and negative corrections are preserved", async () => {
  const data24 = await outsideSnapshot(2024);
  const data26 = await outsideSnapshot(2026);
  assert.equal(
    data24.candidates.H0CA22102?.spenders.find((s) => s.id === "C90017492")
      ?.support,
    718.18,
  );
  const form5 = data26.candidates.H4AL06098?.spenders.find(
    (s) => s.id === "C90011578",
  );
  assert.ok(form5);
  assert.equal(form5.support + form5.oppose, 131018);
  assert.equal(data24.candidates.H2NC06114?.support, -20045.82);
  assert.equal(data26.candidates.H8CA34266?.support, -28149.66);
});
test("affiliation views each reconcile including missing information, remainder and signed adjustments", async () => {
  for (const cycle of CYCLES) {
    const data = await affiliationSnapshot(cycle);
    for (const candidate of snapshot(cycle).candidates) {
      const c = data.candidates[candidate.id];
      assert.ok(c, candidate.id);
      assert.equal(
        cents(c.amount),
        cents(c.positiveAmount) + cents(c.negativeAmount),
      );
      for (const [rows, other, missing] of [
        [c.employers, c.otherEmployerAmount, c.missingEmployerAmount],
        [c.occupations, c.otherOccupationAmount, c.missingOccupationAmount],
      ] as const) {
        assert.equal(
          rows.reduce(
            (sum, r) => sum + cents(r.amount),
            cents(other) + cents(missing),
          ),
          cents(c.amount),
        );
        assert.ok(rows.every((r) => r.count >= 1 && Number.isInteger(r.count)));
      }
      if (c.dateThrough)
        assert.ok(c.dateThrough <= data.downloadedAt.slice(0, 10));
    }
  }
});
test("funding links retain receipt-level evidence and do not allocate receipts to candidates", async () => {
  for (const cycle of CYCLES) {
    const links = await fundingLinksSnapshot(cycle);
    const outside = await outsideSnapshot(cycle);
    assert.equal(links.coverage.status, "complete-query");
    assert.equal(
      links.coverage.importedRecordCount,
      links.coverage.sourceRecordCount,
    );
    for (const candidate of Object.values(outside.candidates)) {
      for (const s of candidate!.spenders)
        assert.ok(links.committees[s.id], s.id);
    }
    for (const c of Object.values(links.committees))
      for (const d of c.donors) {
        assert.equal(d.originalDonorVisibility, "not-determined");
        assert.equal(d.receiptCount, d.records.length);
        assert.equal(
          cents(d.amount),
          d.records.reduce((sum, r) => sum + cents(r.amount), 0),
        );
        for (const record of d.records) {
          assert.ok(record.amount >= links.coverage.minimumReceiptAmount);
          assert.equal(new URL(record.sourceUrl).hostname, "docquery.fec.gov");
        }
        if (d.nonprofit) {
          assert.match(d.nonprofit.ein, /^\d{9}$/);
          assert.ok(
            d.classificationProofURLs.some(
              (url) => new URL(url).hostname === "www.irs.gov",
            ),
          );
        }
      }
  }
});
test("unknown cycle coverage is unavailable and exported audit has explicit federal scope", async () => {
  const unknown = await candidateInfluence("H0CA01205", 2024);
  assert.equal(unknown.outside.status, "not-indexed");
  assert.equal(unknown.outside.support, null);
  assert.equal(unknown.affiliations.record, null);
  assert.match(unknown.outside.sourceAudit.scope, /All federal/);
  assert.ok(unknown.outside.sources.length > 0);
  await assert.rejects(candidateInfluence("H0CA01205", 2028), /Unsupported/);
});
