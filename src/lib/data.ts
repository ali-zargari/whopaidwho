import { datasets } from "@/data/fec/catalog";
import type { Candidate, Filters, Snapshot } from "./types";
import { STATES, currentCycle } from "./format";
// Preserve source values while flagging impossible coverage as of retrieval.
for (const data of Object.values(datasets))
  for (const candidate of data.candidates)
    candidate.coverageDateAnomaly =
      !!candidate.coverageEnd &&
      candidate.coverageEnd > data.downloadedAt.slice(0, 10);
export const CYCLES = Object.keys(datasets)
  .map(Number)
  .sort((a, b) => b - a);
export const DEFAULT_CYCLE = CYCLES.includes(currentCycle())
  ? currentCycle()
  : CYCLES[0];
export function snapshot(cycle: number): Snapshot {
  const data = datasets[cycle];
  if (!data) throw new RangeError("Unsupported reporting cycle");
  return data;
}
export function parseFilters(params: URLSearchParams): Filters {
  const cycle = Number(params.get("cycle") || DEFAULT_CYCLE);
  return {
    q: (params.get("q") || "").trim().slice(0, 100),
    cycle: CYCLES.includes(cycle) ? cycle : DEFAULT_CYCLE,
    office: ["house", "senate"].includes(params.get("office") || "")
      ? params.get("office")!
      : "",
    party: ["DEM", "REP", "IND", "other"].includes(params.get("party") || "")
      ? params.get("party")!
      : "",
    state:
      params.get("state") && STATES[params.get("state")!]
        ? params.get("state")!
        : "",
    // This catalog is navigation, so every legacy or unsupported sort is
    // normalized to the neutral alphabetical order.
    sort: "name",
    page: Math.max(
      1,
      Math.min(10000, Math.floor(Number(params.get("page"))) || 1),
    ),
  };
}
export function filteredCandidates(filters: Filters): Candidate[] {
  const terms = filters.q.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return snapshot(filters.cycle)
    .candidates.filter(
      (c) =>
        (!filters.office || c.office === filters.office) &&
        (!filters.state || c.state === filters.state) &&
        (!filters.party ||
          (filters.party === "other"
            ? !["DEM", "REP", "IND"].includes(c.party)
            : c.party === filters.party)) &&
        terms.every((term) =>
          `${c.name} ${c.id} ${c.state} ${STATES[c.state] || ""}`
            .toLocaleLowerCase()
            .includes(term),
        ),
    )
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}
export function searchCandidates(filters: Filters) {
  const all = filteredCandidates(filters);
  const pages = Math.max(1, Math.ceil(all.length / 24));
  const page = Math.min(pages, filters.page);
  return {
    candidates: all.slice((page - 1) * 24, page * 24),
    total: all.length,
    pages,
    page,
  };
}
const candidateIndexes = new Map<number, Map<string, Candidate>>();
export function getCandidate(id: string, cycle: number) {
  if (!candidateIndexes.has(cycle))
    candidateIndexes.set(
      cycle,
      new Map(snapshot(cycle).candidates.map((c) => [c.id, c])),
    );
  return candidateIndexes.get(cycle)!.get(id);
}
export function toParams(
  values: Record<string, string | string[] | undefined>,
) {
  const result = new URLSearchParams();
  for (const [k, v] of Object.entries(values))
    if (v !== undefined) result.set(k, Array.isArray(v) ? v[0] : v);
  return result;
}
export function filterUrl(filters: Filters, changes: Partial<Filters> = {}) {
  const values = { ...filters, ...changes };
  const p = new URLSearchParams();
  Object.entries(values).forEach(([k, v]) => {
    if (v && !(k === "page" && v === 1)) p.set(k, String(v));
  });
  return `/?${p}`;
}
