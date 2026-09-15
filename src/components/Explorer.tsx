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
import type { Candidate, Filters, SearchResult } from "@/lib/types";
import { useComparison } from "./CompareProvider";
import {
  coverage,
  money,
  number,
  partyName,
  partyClass,
  initials,
  STATES,
  officeLabel,
  contributionTotal,
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
}: {
  filters: Filters;
  result: SearchResult;
  cycles: number[];
  currentCycle: number;
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
            <div className="sort-control">
              <label htmlFor="sort">Sort by</label>
              <select
                disabled={pending}
                id="sort"
                value={draft.sort}
                onChange={(e) => apply({ sort: e.target.value })}
              >
                <option value="receipts">Most receipts</option>
                <option value="cash">Most cash on hand</option>
                <option value="committees">Committee contributions</option>
                <option value="name">Name A–Z</option>
              </select>
            </div>
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
              {result.candidates.map((c, i) => {
                const total = contributionTotal(c);
                const canChart =
                  total > 0 &&
                  [
                    c.individuals,
                    c.committees,
                    c.partyContributions,
                    c.selfContributions,
                  ].every((v) => v >= 0);
                const individualShare = canChart
                  ? (c.individuals / total) * 100
                  : 0;
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
                      <span className="card-rank">
                        {String((result.page - 1) * 24 + i + 1).padStart(
                          2,
                          "0",
                        )}
                      </span>
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
                    <div className="card-money">
                      <span>Reported receipts</span>
                      <strong>{money(c.receipts, true)}</strong>
                    </div>
                    <div className="funding-track" aria-hidden="true">
                      <span style={{ width: `${individualShare}%` }} />
                    </div>
                    <div className="funding-caption">
                      <span>
                        <i />
                        Individuals
                      </span>
                      <span>
                        {canChart
                          ? `${Math.round(individualShare)}% of contributions`
                          : total === 0
                            ? "No contributions reported"
                            : "Signed adjustments — see profile"}
                      </span>
                    </div>
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
