import test from "node:test";
import assert from "node:assert/strict";
import {
  accountabilityCases,
  candidateCases,
  accountabilitySummary,
  filterCases,
  CASE_STATUSES,
} from "../src/lib/accountability";
import {
  enforcement,
  candidateEnforcement,
  searchEnforcement,
  enforcementCoverage,
} from "../src/lib/enforcement";
import { CYCLES, snapshot, getCandidate } from "../src/lib/data";

test("every imported candidate is covered by the same enforcement lookup and the entire index is retained", () => {
  const ids = new Set(
    CYCLES.flatMap((y) => snapshot(y).candidates.map((c) => c.id)),
  );
  assert.equal(enforcement.candidatesChecked, ids.size);
  assert.deepEqual(new Set(enforcement.checkedCandidateIds), ids);
  assert.equal(enforcementCoverage("H0OH06189"), "not-indexed");
  assert.equal(enforcementCoverage("H4NC02192"), "names-unavailable");
  assert.equal(enforcement.index.length, enforcement.indexEntriesScanned);
  assert.equal(
    new Set(enforcement.index.map((c) => c.number)).size,
    enforcement.casesScanned,
  );
  assert.equal(
    new Set(enforcement.index.map((c) => c.url)).size,
    enforcement.indexEntriesScanned,
  );
  assert.equal(
    new Set(enforcement.cases.map((c) => c.number)).size,
    enforcement.cases.length,
  );
  assert.equal(
    new Set(
      enforcement.cases.flatMap((c) => c.matches.map((m) => m.candidateId)),
    ).size,
    enforcement.candidatesMatched,
  );
  for (const id of ids)
    assert.equal(
      accountabilitySummary(id).count,
      candidateEnforcement(id).length,
    );
});
test("published enforcement links have exact identities, verified respondents and official provenance", () => {
  const normalize = (s: string) =>
    s
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  for (const c of enforcement.cases) {
    assert.match(c.source.sha256, /^[a-f0-9]{64}$/);
    assert.equal(new URL(c.url).hostname, "www.fec.gov");
    assert.ok(c.matches.length > 0);
    for (const m of c.matches) {
      assert.ok(CYCLES.some((y) => getCandidate(m.candidateId, y)));
      assert.match(m.committeeId, /^C\d{8}$/);
      assert.equal(normalize(c.name), normalize(m.committeeName));
      assert.ok(
        c.dispositions.some(
          (g) =>
            g.matchedCandidateIds.includes(m.candidateId) &&
            g.respondents.some(
              (n) => normalize(n) === normalize(m.committeeName),
            ),
        ),
      );
    }
    for (const g of c.dispositions)
      for (const id of g.matchedCandidateIds)
        assert.ok(
          c.matches.some(
            (m) =>
              m.candidateId === id &&
              g.respondents.some(
                (n) => normalize(n) === normalize(m.committeeName),
              ),
          ),
        );
  }
});
test("cross-party cases preserve exact source groups and no-match is not clearance", () => {
  assert.equal(
    candidateEnforcement("H2IL01281")
      .find((c) => c.number === "8285")
      ?.dispositions.find((g) => g.matchedCandidateIds.includes("H2IL01281"))
      ?.penalty,
    "$10,000.00",
  );
  const crenshaw = candidateEnforcement("H8TX02166").find(
    (c) => c.number === "8030",
  );
  assert.equal(crenshaw?.dispositions.length, 1);
  assert.equal(crenshaw?.dispositions[0].respondents.length, 2);
  assert.equal(crenshaw?.dispositions[0].penalty, "$42,000.00");
  const unknown = accountabilitySummary("H4NC02192");
  assert.equal(unknown.count, 0);
  assert.match(unknown.detail, /not a clearance/);
  assert.deepEqual(candidateEnforcement("INVALID"), []);
});
test("enforcement search intersects candidate and respondent disposition, with bounded pagination", () => {
  const before = enforcement.cases.map((c) => c.number);
  const result = searchEnforcement(
    "H8TX02166",
    "Conciliation: Pre Probable Cause",
    1000,
  );
  assert.deepEqual(
    result.cases.map((c) => c.number),
    ["8030"],
  );
  assert.equal(result.page, 1);
  assert.equal(searchEnforcement("H8TX02166", "No Reason to Believe").total, 0);
  assert.deepEqual(
    enforcement.cases.map((c) => c.number),
    before,
  );
});
test("reviewed cases distinguish identity, allegation, finding, dismissal and later sentence changes", () => {
  const unique = new Set<string>();
  for (const c of accountabilityCases) {
    assert.ok(!unique.has(c.id));
    unique.add(c.id);
    assert.ok(CYCLES.some((y) => getCandidate(c.candidateId, y)));
    assert.ok(c.status in CASE_STATUSES);
    assert.ok(c.reviewedAt >= c.eventDate);
    assert.ok(c.reviewedAt <= new Date().toISOString().slice(0, 10));
    assert.ok(c.sources.length >= 2);
    for (const source of c.sources)
      assert.match(new URL(source.url).hostname, /(^|\.)gov$/);
  }
  assert.equal(
    candidateCases("S2TX00312").filter((c) => c.id === "fec-7001-cruz-loans")
      .length,
    1,
  );
  assert.equal(
    candidateCases("S2TX00312").find((c) => c.id === "fec-8238-cruz-podcast")
      ?.status,
    "dismissed",
  );
  assert.match(
    candidateCases("H0NY03083")[0].outcome,
    /no further fines, restitution/,
  );
  assert.equal(candidateCases("H2FL07156")[0].status, "investigation");
  assert.match(candidateCases("H8NY15148")[0].context, /do not confirm/);
  assert.equal(filterCases("Goldman", "settlement").length, 1);
  assert.equal(filterCases("Goldman", "dismissed").length, 0);
  assert.equal(filterCases("Met Gala", "finding").length, 1);
});
