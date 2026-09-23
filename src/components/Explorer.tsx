"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  SlidersHorizontal,
  X,
  Check,
  Download,
  Scale,
} from "lucide-react";
import type { Candidate, Filters, SearchResult, OutsideOverview } from "@/lib/types";
import CandidateFundingSummary from "./CandidateFundingSummary";
import AccountabilityBadge from "./AccountabilityBadge";
import type { accountabilitySummary } from "@/lib/accountability";
import { useComparison } from "./CompareProvider";
import {
  coverage,
  date,
  number,
  partyName,
  partyClass,
  initials,
  STATES,
  officeLabel,
} from "@/lib/format";
function url(filters: Filters) {
  const p = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v) p.set(k, String(v));
  });
  return `/?${p}`;
}
export default function Explorer({
  filters,
  result,
  cycles,
  currentCycle,
  accountability,
  outside,
  outsideDownloadedAt,
}: {
  filters: Filters;
  result: SearchResult;
  cycles: number[];
  currentCycle: number;
  accountability: Record<string, ReturnType<typeof accountabilitySummary>>;
  outside: Record<string, OutsideOverview>;
  outsideDownloadedAt: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState(filters);
  const selection = useComparison();
  const selected = selection.selected.filter((c) => c.cycle === filters.cycle);
  const setSelected = selection.setSelected;
  function apply(changes: Partial<Filters> = {}) {
    const next = { ...draft, ...changes, page: changes.page || 1 };
    setDraft(next);
    startTransition(() => router.push(url(next), { scroll: false }));
  }
  function toggle(c: Candidate) {
    setSelected((previous) => {
      const list = previous.filter((x) => x.cycle === filters.cycle);
      return list.some((x) => x.id === c.id)
        ? list.filter((x) => x.id !== c.id)
        : list.length < 3
          ? [...list, c]
          : list;
    });
  }
  const filterCount = [
    filters.party,
    filters.state,
    filters.office,
    filters.q,
  ].filter(Boolean).length;
  return (
    <section className="explorer" aria-labelledby="explore-heading">
      <div className="section-heading">
        <div>
          <span className="eyebrow">THE CAMPAIGN FINANCE EXPLORER</span>
          <h2 id="explore-heading">Find the people. Follow the funding.</h2>
        </div>
        <a
          className="text-button export-button"
          href={`/api/export?${url(filters).split("?")[1]}`}
        >
          <Download size={16} /> Export results
        </a>
      </div>
      <form
        className="search-bar"
        onSubmit={(e) => {
          e.preventDefault();
          apply();
        }}
        role="search"
      >
        <Search size={21} />
        <label className="sr-only" htmlFor="candidate-search">
          Search candidates
        </label>
        <input
          id="candidate-search"
          disabled={pending}
          placeholder="Search a name, state, or FEC candidate ID"
          value={draft.q}
          onChange={(e) => setDraft({ ...draft, q: e.target.value })}
        />
        {draft.q && (
          <button
            type="button"
            className="icon-button"
            aria-label="Clear search"
            onClick={() => apply({ q: "" })}
          >
            <X size={17} />
          </button>
        )}
        <button className="primary-button" type="submit" disabled={pending}>
          Search <ArrowRight size={16} />
        </button>
      </form>
      <div className="explorer-body">
        <aside className="filters">
          <div className="filter-title">
            <SlidersHorizontal size={16} />
            <h3>Refine results</h3>
            {filterCount > 0 && (
              <button
                className="reset-button"
                onClick={() => {
                  const next = {
                    ...filters,
                    q: "",
                    party: "",
                    state: "",
                    office: "",
                    page: 1,
                  };
                  setDraft(next);
                  startTransition(() => router.push(url(next)));
                }}
              >
                Reset
              </button>
            )}
          </div>
          <label className="filter-label" htmlFor="cycle">
            Reporting cycle
          </label>
          <select
            disabled={pending}
            id="cycle"
            value={draft.cycle}
            onChange={(e) => apply({ cycle: Number(e.target.value) })}
          >
            {cycles.map((c) => (
              <option key={c} value={c}>
                {c - 1}–{c}
                {c === currentCycle ? " · Current cycle" : ""}
              </option>
            ))}
          </select>
          <fieldset disabled={pending}>
            <legend>Office</legend>
            {[
              ["", "All Congress"],
              ["senate", "U.S. Senate"],
              ["house", "U.S. House"],
            ].map(([value, label]) => (
              <label className="filter-option" key={value}>
                <input
                  type="radio"
                  name="office"
                  checked={draft.office === value}
                  onChange={() => apply({ office: value })}
                />
                {label}
              </label>
            ))}
          </fieldset>
          <fieldset disabled={pending}>
            <legend>Party</legend>
            {[
              ["", "All parties"],
              ["DEM", "Democrat"],
              ["REP", "Republican"],
              ["IND", "Independent"],
              ["other", "Other parties"],
            ].map(([value, label]) => (
              <label className="filter-option" key={value}>
                <input
                  type="radio"
                  name="party"
                  checked={draft.party === value}
                  onChange={() => apply({ party: value })}
                />
                {value && <span className={`party-dot ${partyClass(value)}`} />}{" "}
                {label}
              </label>
            ))}
          </fieldset>
          <label className="filter-label" htmlFor="state">
            State or territory
          </label>
          <select
            disabled={pending}
            id="state"
            value={draft.state}
            onChange={(e) => apply({ state: e.target.value })}
          >
            <option value="">All states & territories</option>
            {Object.entries(STATES)
              .sort((a, b) => a[1].localeCompare(b[1]))
              .map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
          </select>
          <div className="filter-note">
            <span className="mini-label">A NOTE ON COVERAGE</span>
            <p>
              Candidates with financial activity in this two-year period. This
              is not a roster of current officeholders.
            </p>
            <Link href="/methodology">
              Understand the data <ArrowUpRight size={13} />
            </Link>
          </div>
        </aside>
        <div className="results" aria-busy={pending}>
          <div className="results-toolbar">
            <p role="status">
              <strong>{number(result.total)}</strong> candidates{" "}
              {filters.q && <span>for “{filters.q}”</span>}
              {pending && <span className="loading-label"> · Updating…</span>}
            </p>
            <span className="directory-order">Name A–Z</span>
          </div>
          <div className="overview-explainer">
            <strong>The campaign account is only one part of the picture.</strong>
            <p>
              Each card shows campaign receipts alongside reported independent
              spending to support or oppose the candidate. These are separate
              measures, with separate reporting timelines.
            </p>
            <p>
              “Individuals” includes both small and large personal donations;
              it does not mean grassroots. Original donors behind outside
              groups may be undisclosed.{" "}
              <Link href="/methodology#outside">Read the scope & sources ↗</Link>
            </p>
            <span>Outside filings retrieved {date(outsideDownloadedAt)} · Recent 24/48-hour notices may not yet appear.</span>
          </div>
          {result.total === 0 ? (
            <div className="empty-state">
              <Search size={30} />
              <h3>No candidates match these filters.</h3>
              <p>
                Try a last name, another state, or a different reporting cycle.
              </p>
              <Link href="/" className="primary-button">
                Clear all filters
              </Link>
            </div>
          ) : (
            <div className={`candidate-grid ${pending ? "is-pending" : ""}`}>
              {result.candidates.map((c) => {
                const picked = selected.some((s) => s.id === c.id);
                return (
                  <article className="candidate-card" key={c.id}>
                    <div className="card-top">
                      <span className={`avatar ${partyClass(c.party)}`}>
                        {initials(c.name)}
                      </span>
                      <span className={`party-badge ${partyClass(c.party)}`}>
                        {partyName(c.party)}
                      </span>
                      <span className="card-period">{filters.cycle - 1}–{filters.cycle}</span>
                    </div>
                    <Link
                      className="candidate-title"
                      href={`/candidate/${c.id}?cycle=${filters.cycle}`}
                      prefetch={false}
                    >
                      <h3>{c.name}</h3>
                      <ArrowUpRight size={19} />
                    </Link>
                    <p className="candidate-location">
                      {STATES[c.state] || c.state}
                      <span> · </span>
                      {officeLabel(c)}
                    </p>
                    <AccountabilityBadge
                      candidateId={c.id}
                      cycle={filters.cycle}
                      summary={accountability[c.id]}
                    />
                    <CandidateFundingSummary
                      candidate={c}
                      outside={outside[c.id]}
                      outsideDownloadedAt={outsideDownloadedAt}
                    />
                    <div className="card-footer">
                      <span>{coverage(c)}</span>
                      <button
                        className={`compare-toggle ${picked ? "selected" : ""}`}
                        aria-label={`${picked ? "Remove" : "Compare"} ${c.name}`}
                        aria-pressed={picked}
                        disabled={!picked && selected.length === 3}
                        onClick={() => toggle(c)}
                      >
                        {picked ? <Check size={14} /> : <span>+</span>} Compare
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          {result.pages > 1 && (
            <div className="pagination">
              <button
                className="secondary-button"
                disabled={result.page === 1 || pending}
                onClick={() => apply({ page: result.page - 1 })}
              >
                <ArrowLeft size={16} />
                Previous
              </button>
              <span>
                Page {result.page} of {result.pages}
              </span>
              <button
                className="secondary-button"
                disabled={result.page === result.pages || pending}
                onClick={() => apply({ page: result.page + 1 })}
              >
                Next
                <ArrowRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
      {selected.length > 0 && (
        <div className="compare-tray">
          <Scale size={21} />
          <div>
            <strong>{selected.length} of 3 selected</strong>
            <span>{selected.map((c) => c.name).join(" · ")}</span>
          </div>
          <button className="text-button" onClick={() => setSelected([])}>
            Clear
          </button>
          {selected.length > 1 ? (
            <Link
              className="primary-button"
              href={`/compare?cycle=${filters.cycle}&ids=${selected.map((c) => c.id).join(",")}`}
            >
              Compare funding
              <ArrowRight size={16} />
            </Link>
          ) : (
            <span className="tray-hint">Select one more candidate</span>
          )}
        </div>
      )}
    </section>
  );
}
