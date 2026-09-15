import { snapshot, getCandidate } from "./data";
import { contributionTotal, STATES } from "./format";
import type { Registration } from "./types";
export type Race = {
  id: string;
  office: string;
  state: string;
  district: string;
  name: string;
  registrations: Registration[];
  reportedContributions: number;
};
export function getRaces(cycle: number): Race[] {
  const groups = new Map<string, Race>();
  for (const r of snapshot(cycle).registrations) {
    if (!r.state || (r.office === "house" && !r.district)) continue;
    const id = `${r.office}-${r.state}${r.office === "house" ? `-${r.district}` : ""}`;
    if (!groups.has(id))
      groups.set(id, {
        id,
        office: r.office,
        state: r.state,
        district: r.district,
        name: `${STATES[r.state] || r.state} · ${r.office === "senate" ? "U.S. Senate" : r.district === "00" ? "House at-large" : `House District ${Number(r.district)}`}`,
        registrations: [],
        reportedContributions: 0,
      });
    const group = groups.get(id)!;
    group.registrations.push(r);
    const c = getCandidate(r.id, cycle);
    if (c) group.reportedContributions += contributionTotal(c);
  }
  return [...groups.values()]
    .map((r) => ({
      ...r,
      registrations: r.registrations.sort(
        (a, b) =>
          (getCandidate(b.id, cycle)?.receipts ?? -1) -
          (getCandidate(a.id, cycle)?.receipts ?? -1),
      ),
    }))
    .sort(
      (a, b) =>
        b.reportedContributions - a.reportedContributions ||
        a.id.localeCompare(b.id),
    );
}
