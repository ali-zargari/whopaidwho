import { ArrowUpRight, Database, Landmark, Users } from "lucide-react";
import Link from "next/link";
import Explorer from "@/components/Explorer";
import { accountabilitySummary } from "@/lib/accountability";
import {
  parseFilters,
  searchCandidates,
  snapshot,
  toParams,
  CYCLES,
} from "@/lib/data";
import { date, number, currentCycle } from "@/lib/format";
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = toParams(await searchParams);
  const filters = parseFilters(params);
  const data = snapshot(filters.cycle);
  const result = searchCandidates(filters);
  return (
    <main id="main" className="page-shell">
      <section className="intro">
        <div>
          <div className="eyebrow">
            <span className="edition-label">THE PUBLIC RECORD</span> U.S.
            CAMPAIGN FINANCE
          </div>
          <h1>
            Follow the money<span>.</span>
          </h1>
          <p>
            See how congressional campaigns are funded. Start with the facts.
          </p>
        </div>
        <Link href="/methodology" className="source-stamp">
          <Database size={20} />
          <div>
            <strong>Real filings. Original sources.</strong>
            <span>FEC snapshot · {date(data.downloadedAt)}</span>
          </div>
          <ArrowUpRight size={17} />
        </Link>
      </section>
      <Link href={`/races?cycle=${filters.cycle}`} className="races-entry">
        <span>
          <strong>Explore the races behind the numbers</strong>
          <span>
            Company PAC connections, individual contributions, and outside
            spending.
          </span>
        </span>
        <span>
          Open funding maps <ArrowUpRight size={17} />
        </span>
      </Link>
      <div className="overview-strip">
        <div>
          <Users size={19} />
          <span>Congressional candidates</span>
          <strong>{number(data.candidates.length)}</strong>
        </div>
        <div>
          <Landmark size={19} />
          <span>Senate campaigns</span>
          <strong>
            {number(
              data.candidates.filter((c) => c.office === "senate").length,
            )}
          </strong>
        </div>
        <div>
          <Landmark size={19} />
          <span>House campaigns</span>
          <strong>
            {number(data.candidates.filter((c) => c.office === "house").length)}
          </strong>
        </div>
        <div className="cycle-stat">
          <span>
            {filters.cycle === currentCycle()
              ? "Current cycle"
              : "Reporting cycle"}
          </span>
          <strong>
            {filters.cycle - 1}–{filters.cycle}
          </strong>
        </div>
      </div>
      {!CYCLES.includes(currentCycle()) && (
        <p className="profile-notice">
          The current cycle is {currentCycle() - 1}–{currentCycle()}. The newest
          imported snapshot is {CYCLES[0] - 1}–{CYCLES[0]}; a data refresh is
          needed before current-cycle figures can be shown.
        </p>
      )}
      <Explorer
        key={params.toString()}
        filters={filters}
        result={result}
        cycles={CYCLES}
        currentCycle={currentCycle()}
        accountability={Object.fromEntries(
          result.candidates.map((c) => [c.id, accountabilitySummary(c.id)]),
        )}
      />
      <section className="context-band">
        <span className="context-number">01 /</span>
        <h2>
          A contribution is a fact.
          <br />
          Influence is a question.
        </h2>
        <div>
          <p>
            These are campaign disclosures, not a verdict on anyone’s motives.
            We link the numbers to their sources so you can draw your own
            conclusions.
          </p>
          <Link href="/methodology">
            How to read the numbers <ArrowUpRight size={16} />
          </Link>
        </div>
      </section>
    </main>
  );
}
