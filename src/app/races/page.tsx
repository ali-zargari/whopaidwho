import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight, Network, ArrowRight } from "lucide-react";
import {
  CYCLES,
  parseFilters,
  toParams,
  getCandidate,
  snapshot,
} from "@/lib/data";
import { getRaces } from "@/lib/races";
import {
  money,
  contributionTotal,
  partyClass,
  date,
  currentCycle,
} from "@/lib/format";
import RaceFilters from "@/components/RaceFilters";
export const metadata: Metadata = { title: "Current races & funding maps" };
export default async function RacesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseFilters(toParams(await searchParams));
  const all = getRaces(filters.cycle).filter(
    (r) =>
      (!filters.state || r.state === filters.state) &&
      (!filters.office || r.office === filters.office),
  );
  const page = Math.min(filters.page, Math.max(1, Math.ceil(all.length / 18)));
  const races = all.slice((page - 1) * 18, page * 18);
  const data = snapshot(filters.cycle);
  return (
    <main id="main" className="page-shell races-page">
      <section className="race-intro">
        <div>
          <span className="eyebrow">
            <span className="edition-label">
              {filters.cycle === currentCycle()
                ? "CURRENT RACES"
                : `${filters.cycle} RACES`}
            </span>
            FOLLOW THE CONNECTIONS
          </span>
          <h1>Every race has a money trail.</h1>
          <p>
            Explore the people, PACs, and outside spending behind congressional
            campaigns.
          </p>
        </div>
        <Network size={58} />
      </section>
      <div className="race-scope">
        <strong>{filters.cycle} FEC registrations</strong>
        <p>
          Grouped by state, office, and district. Includes primary filings and
          candidates who may no longer be running. This is not a certified
          ballot or nominee list.
        </p>
        <span>Snapshot {date(data.downloadedAt)}</span>
      </div>
      <RaceFilters
        cycle={filters.cycle}
        cycles={CYCLES}
        state={filters.state}
        office={filters.office}
      />
      <div className="section-heading">
        <h2>{all.length} race groups</h2>
        <span className="muted-text">Sorted by reported contributions</span>
      </div>
      {races.length ? (
        <div className="race-grid">
          {races.map((r) => {
            const top = r.registrations.slice(0, 3);
            return (
              <article className="race-card" key={r.id}>
                <div className="race-card-kicker">
                  <span>
                    {r.office === "senate" ? "SENATE" : "HOUSE"} · {r.state}
                  </span>
                  <span>{r.registrations.length} registered candidates</span>
                </div>
                <Link href={`/races/${r.id}?cycle=${filters.cycle}`}>
                  <h2>
                    {r.name}
                    <ArrowUpRight size={20} />
                  </h2>
                </Link>
                <div className="race-card-candidates">
                  {top.map((p) => {
                    const c = getCandidate(p.id, filters.cycle);
                    return (
                      <div key={p.id}>
                        <span className={`party-dot ${partyClass(p.party)}`} />
                        <span>{p.name}</span>
                        <strong>
                          {c
                            ? money(contributionTotal(c), true)
                            : "Not reported"}
                        </strong>
                      </div>
                    );
                  })}
                </div>
                <div className="race-card-foot">
                  <span>Contributions to campaigns</span>
                  <Link href={`/races/${r.id}?cycle=${filters.cycle}`}>
                    Funding map
                    <ArrowRight size={15} />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <h2>No registered race groups match.</h2>
          <p>Try a different state, office, or cycle.</p>
          <Link
            href={`/races?cycle=${filters.cycle}`}
            className="primary-button"
          >
            Reset race filters
          </Link>
        </div>
      )}
      {all.length > 18 && (
        <div className="pagination">
          {page > 1 ? (
            <Link
              className="secondary-button"
              href={`/races?cycle=${filters.cycle}&state=${filters.state}&office=${filters.office}&page=${page - 1}`}
            >
              Previous
            </Link>
          ) : (
            <span />
          )}
          <span>
            Page {page} of {Math.ceil(all.length / 18)}
          </span>
          {page < Math.ceil(all.length / 18) && (
            <Link
              className="secondary-button"
              href={`/races?cycle=${filters.cycle}&state=${filters.state}&office=${filters.office}&page=${page + 1}`}
            >
              Next
              <ArrowRight size={15} />
            </Link>
          )}
        </div>
      )}
      <div className="callout race-bottom-note">
        <p>
          Company branding identifies a PAC’s FEC-reported connected
          organization. PAC money is not a direct corporate treasury
          contribution. Outside spending and unknown original funding sources
          are shown separately.{" "}
          <Link href="/methodology#outside">
            How we handle outside and dark money ↗
          </Link>
        </p>
      </div>
    </main>
  );
}
