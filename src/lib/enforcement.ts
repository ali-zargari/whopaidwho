import saved from "@/data/accountability/fec-enforcement.json";
import { CYCLES, getCandidate } from "./data";

type Source = { url: string; sha256: string; fetchedAt: string };
export type EnforcementCase = {
  number: string;
  name: string;
  url: string;
  matches: {
    candidateId: string;
    committeeId: string;
    committeeName: string;
    method: string;
  }[];
  dispositions: {
    disposition: string;
    penalty: string | null;
    respondents: string[];
    matchedCandidateIds: string[];
  }[];
  documents: {
    category: string;
    date: string | null;
    label: string;
    url: string;
  }[];
  relatedMatters: string[];
  latestDocumentDate: string | null;
  source: Source;
};
type EnforcementSnapshot = {
  schemaVersion: number;
  startedAt: string;
  downloadedAt: string;
  source: string;
  cycles: number[];
  candidatesChecked: number;
  candidatesWithCommitteeNames: number;
  checkedCandidateIds: string[];
  candidateIdsWithCommitteeNames: string[];
  casesScanned: number;
  indexEntriesScanned: number;
  candidatesMatched: number;
  ambiguousCommitteeNames: number;
  exclusions: { number: string; reason: string }[];
  sources: Source[];
  index: { number: string; name: string; url: string }[];
  cases: EnforcementCase[];
};
export const enforcement = saved as EnforcementSnapshot;
const checkedIds = new Set(enforcement.checkedCandidateIds);
const namedIds = new Set(enforcement.candidateIdsWithCommitteeNames);
export function enforcementCoverage(candidateId: string) {
  return !checkedIds.has(candidateId)
    ? "not-indexed"
    : !namedIds.has(candidateId)
      ? "names-unavailable"
      : "available";
}
const byCandidate = new Map<string, EnforcementCase[]>();
for (const record of enforcement.cases) {
  for (const id of new Set(record.matches.map((m) => m.candidateId))) {
    const list = byCandidate.get(id) || [];
    list.push(record);
    byCandidate.set(id, list);
  }
}
const byDate = (a: EnforcementCase, b: EnforcementCase) =>
  (b.latestDocumentDate || "").localeCompare(a.latestDocumentDate || "") ||
  Number(b.number) - Number(a.number);
for (const records of byCandidate.values()) records.sort(byDate);
export function candidateEnforcement(candidateId: string) {
  return byCandidate.get(candidateId) || [];
}
export function candidateProfile(candidateId: string, preferredCycle: number) {
  const cycle = getCandidate(candidateId, preferredCycle)
    ? preferredCycle
    : CYCLES.find((y) => getCandidate(candidateId, y));
  return cycle ? getCandidate(candidateId, cycle) : undefined;
}
export function searchEnforcement(q: string, disposition: string, page = 1) {
  const terms = q
    .trim()
    .toLowerCase()
    .slice(0, 100)
    .split(/\s+/)
    .filter(Boolean);
  const filtered = enforcement.cases
    .filter(
      (c) =>
        (!disposition ||
          c.dispositions.some(
            (d) =>
              d.matchedCandidateIds.length > 0 && d.disposition === disposition,
          )) &&
        terms.every((term) =>
          `${c.number} ${c.name} ${c.matches.map((m) => `${m.candidateId} ${m.committeeId} ${m.committeeName} ${candidateProfile(m.candidateId, CYCLES[0])?.name || ""}`).join(" ")} ${c.dispositions
            .filter((d) => d.matchedCandidateIds.length > 0)
            .map((d) => d.disposition)
            .join(" ")}`
            .toLowerCase()
            .includes(term),
        ),
    )
    .sort(byDate);
  const pages = Math.max(1, Math.ceil(filtered.length / 20));
  const current = Math.max(1, Math.min(pages, Math.floor(page) || 1));
  return {
    cases: filtered.slice((current - 1) * 20, current * 20),
    total: filtered.length,
    pages,
    page: current,
  };
}
export const enforcementDispositions = [
  ...new Set(
    enforcement.cases.flatMap((c) =>
      c.dispositions
        .filter((d) => d.matchedCandidateIds.length > 0)
        .map((d) => d.disposition),
    ),
  ),
].sort();
