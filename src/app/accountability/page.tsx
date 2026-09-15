import Link from "next/link";
import type { Metadata } from "next";
import { Search, FileSearch, ArrowUpRight } from "lucide-react";
import {
  accountabilityCases,
  CASE_STATUSES,
  filterCases,
} from "@/lib/accountability";
import {
  enforcement,
  enforcementDispositions,
  searchEnforcement,
} from "@/lib/enforcement";
import { parseFilters, toParams } from "@/lib/data";
import { date, number } from "@/lib/format";
import { CaseCard } from "@/components/AccountabilityPanel";
import EnforcementRecord from "@/components/EnforcementRecord";
export const metadata: Metadata = {
  title: "Investigations, findings & accountability",
  description:
    "Explore official FEC enforcement records with the same campaign matching rules for every candidate, plus sourced investigations and case outcomes.",
};
export default async function AccountabilityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = toParams(await searchParams);
  const { cycle } = parseFilters(params);
  const reviewed = params.get("view") === "reviewed";
  const q = (params.get("q") || "").slice(0, 100);
  const raw = params.get("status") || "";
  const status = reviewed
    ? Object.hasOwn(CASE_STATUSES, raw)
      ? raw
      : ""
    : enforcementDispositions.includes(raw)
      ? raw
      : "";
  const records = searchEnforcement(
    q,
    reviewed ? "" : status,
    Number(params.get("page") || 1),
  );
  const cases = filterCases(q, reviewed ? status : "");
  const pageUrl = (page: number) =>
    `/accountability?${new URLSearchParams({ cycle: String(cycle), q, status, page: String(page) })}`;
  return (
    <main id="main" className="page-shell accountability-page">
      <section className="accountability-hero">
        <div>
          <span className="eyebrow">
            PUBLIC RECORDS · SAME STANDARD FOR EVERY CANDIDATE
          </span>
          <h1>
            Investigations, findings
            <br />& documented outcomes.
          </h1>
          <p>
            See the conduct behind the funding totals. Follow official records,
            read each respondent’s outcome, and distinguish allegations from
            findings.
          </p>
        </div>
        <FileSearch size={56} />
      </section>
      <div className="accountability-scope">
        <strong>
          {number(enforcement.candidatesChecked)} candidate IDs checked ·{" "}
          {number(enforcement.casesScanned)} FEC case titles scanned
        </strong>
        <p>
          The same matching rules found {number(enforcement.cases.length)}{" "}
          published case numbers linked to{" "}
          {number(enforcement.candidatesMatched)} candidates’ campaigns.
          Complete committee names must match unambiguously and appear as
          respondents in the case. This is a limited lookup, not a background
          check or a corruption score.
        </p>
        <p>
          Source retrieved {date(enforcement.downloadedAt)}. Secondary
          respondents, name changes, and other enforcement programs can be
          absent.
        </p>
        <Link href="/methodology#accountability">
          Coverage, matching rules & corrections
          <ArrowUpRight size={14} />
        </Link>
      </div>
      <nav
        className="accountability-views"
        aria-label="Accountability collections"
      >
        <Link
          href={`/accountability?cycle=${cycle}`}
          aria-current={!reviewed ? "page" : undefined}
        >
          FEC enforcement index
          <span>{number(enforcement.cases.length)} case numbers</span>
        </Link>
        <Link
          href={`/accountability?view=reviewed&cycle=${cycle}`}
          aria-current={reviewed ? "page" : undefined}
        >
          Reviewed investigations & context
          <span>{accountabilityCases.length} selected records</span>
        </Link>
      </nav>
      {reviewed && (
        <p className="coverage-label">
          This supplementary collection includes broader investigations and
          context for selected FEC matters. Most candidates have not received
          this narrative review. Some records also appear in the FEC index; do
          not add counts across collections.
        </p>
      )}
      <form
        className="accountability-filters"
        action="/accountability"
        role="search"
      >
        <input type="hidden" name="cycle" value={cycle} />
        <input
          type="hidden"
          name="view"
          value={reviewed ? "reviewed" : "fec"}
        />
        <label htmlFor="case-search">
          {reviewed
            ? "Candidate, case or subject"
            : "Candidate, committee or case number"}
          <div>
            <Search size={18} />
            <input
              id="case-search"
              name="q"
              defaultValue={q}
              placeholder="Search a name, FEC ID, or case number"
            />
          </div>
        </label>
        <div className="accountability-status-filter">
          <label htmlFor="case-status">
            {reviewed ? "Record status" : "FEC disposition"}
          </label>
          <select id="case-status" name="status" defaultValue={status}>
            <option value="">
              {reviewed ? "All statuses" : "All dispositions"}
            </option>
            {reviewed
              ? Object.entries(CASE_STATUSES).map(([key, s]) => (
                  <option key={key} value={key}>
                    {s.label}
                  </option>
                ))
              : enforcementDispositions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
          </select>
        </div>
        <button className="primary-button" type="submit">
          Search records
        </button>
      </form>
      <div className="section-heading">
        <h2>
          {number(reviewed ? cases.length : records.total)} matching{" "}
          {reviewed ? (cases.length === 1 ? "case record" : "case records") : (records.total === 1 ? "FEC case number" : "FEC case numbers")}
        </h2>
        <span className="muted-text">
          {reviewed ? "Most recent action" : "Most recent document"} first · all
          years
        </span>
      </div>
      {(reviewed ? cases.length : records.total) ? (
        <div className="case-list">
          {reviewed
            ? cases.map((c) => (
                <CaseCard record={c} key={c.id} cycle={cycle} showCandidate />
              ))
            : records.cases.map((c) => (
                <EnforcementRecord key={c.number} record={c} cycle={cycle} />
              ))}
        </div>
      ) : (
        <div className="empty-state">
          <h2>No entries match this search.</h2>
          <p>
            Coverage is limited. An empty search is not a finding of no
            misconduct.
          </p>
          <Link
            className="secondary-button"
            href={`/accountability?cycle=${cycle}${reviewed ? "&view=reviewed" : ""}`}
          >
            Reset case filters
          </Link>
        </div>
      )}
      {!reviewed && records.pages > 1 && (
        <nav
          className="pagination enforcement-pagination"
          aria-label="Enforcement pages"
        >
          {records.page > 1 ? (
            <Link className="secondary-button" href={pageUrl(records.page - 1)}>
              Previous
            </Link>
          ) : (
            <span />
          )}
          <span>
            Page {records.page} of {records.pages}
          </span>
          {records.page < records.pages ? (
            <Link className="secondary-button" href={pageUrl(records.page + 1)}>
              Next
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
      <section className="accountability-definitions">
        <h2>Read the decision before drawing a conclusion.</h2>
        <p>
          FEC disposition labels describe agency procedure. “No reason to
          believe,” dismissals, and conciliations mean different things. A case
          can have different outcomes for different respondents.{" "}
          <a
            href="https://www.fec.gov/legal-resources/how-to-use-fec-legal-search-systems/"
            target="_blank"
            rel="noreferrer"
          >
            Read the FEC’s legal search guide ↗
          </a>
        </p>
        <div>
          {Object.entries(CASE_STATUSES).map(([key, s]) => (
            <article key={key}>
              <h3 className={`case-status ${s.tone}`}>{s.label}</h3>
              <p>{s.definition}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
