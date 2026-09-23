import Link from "next/link";
import type { Candidate, OutsideOverview } from "@/lib/types";
import { contributionTotal, date, fecUrl, money } from "@/lib/format";

export default function CandidateFundingSummary({
  candidate: c,
  outside,
  outsideDownloadedAt,
}: {
  candidate: Candidate;
  outside: OutsideOverview;
  outsideDownloadedAt: string;
}) {
  const total = contributionTotal(c);
  const categories = [
    { label: "Individuals", value: c.individuals, kind: "individuals" },
    { label: "Political committees", value: c.committees, kind: "committees" },
    { label: "Candidate contributions", value: c.selfContributions, kind: "candidate" },
    { label: "Party committees", value: c.partyContributions, kind: "party" },
  ];
  const canChart = total > 0 && categories.every((row) => row.value >= 0);
  const metrics = [
    { label: "Campaign receipts", value: c.receipts, kind: "receipts", source: fecUrl(c) },
    { label: "Outside support", value: outside.support, kind: "support", source: outside.sourceUrl },
    { label: "Outside opposition", value: outside.oppose, kind: "opposition", source: outside.sourceUrl },
  ];
  const maximum = Math.max(1, ...metrics.map((row) => row.value ?? 0));
  // The bulk summary does not separately identify every remaining receipt line.
  const remainder = Math.round(
    (c.receipts - total - c.candidateLoans - c.otherLoans - c.transfersIn) * 100,
  ) / 100;
  const profile = `/candidate/${c.id}?cycle=${c.cycle}`;

  return (
    <div className="card-funding-summary">
      <dl className="card-funding-metrics">
        {metrics.map((row) => (
          <div className={`card-funding-metric ${row.kind}`} key={row.kind}>
            <dt>{row.label}</dt>
            <dd>
              <a href={row.source} target="_blank" rel="noreferrer"
                aria-label={`${row.label}: ${row.value === null ? "not indexed" : money(row.value)}. FEC source`}
                title={row.value === null ? "Not indexed" : money(row.value)}>
                {row.value === null ? "Not indexed" : money(row.value, true)}
              </a>
            </dd>
            <span className="card-metric-bar" aria-hidden="true">
              <i style={{ width: `${Math.max(0, row.value ?? 0) / maximum * 100}%` }} />
            </span>
          </div>
        ))}
      </dl>
      <p className="card-scope-note">
        Receipts and outside spending are separate measures; bars share a dollar scale.
        {metrics.some((row) => row.value !== null && row.value < 0) &&
          " Negative amounts are net reported adjustments; bars show positive amounts only."}
      </p>
      <p className="card-outside-source">
        <a href={outside.sourceUrl} target="_blank" rel="noreferrer">FEC outside filings ↗</a>
        <span>Retrieved {date(outsideDownloadedAt)}</span>
      </p>
      {outside.status !== "reported" && (
        <p className="card-coverage-note">
          {outside.status === "not-indexed"
            ? "Outside spending is not indexed for this candidate and cycle."
            : "No matching outside spending in this processed snapshot."}
          {" "}Unreported activity and recent notices may be missing.
        </p>
      )}

      <div className="card-contribution-heading">
        <strong>Contributions to the campaign</strong>
        <span title={money(total)}>{money(total, true)}</span>
      </div>
      {canChart && (
        <div className="card-contribution-track" aria-hidden="true">
          {categories.map((row) => (
            <span key={row.kind} className={row.kind}
              style={{ width: `${row.value / total * 100}%` }} />
          ))}
        </div>
      )}
      <dl className="card-contribution-rows">
        {categories.map((row) => (
          <div key={row.kind}>
            <dt><i className={row.kind} aria-hidden="true" />{row.label}</dt>
            <dd>
              <span title={money(row.value)}>{money(row.value, true)}</span>
              {canChart && <small>{(row.value / total * 100).toFixed(1)}%</small>}
            </dd>
          </div>
        ))}
      </dl>
      <p className="card-scope-note">
        {canChart ? "Percentages are of contributions only; loans and other receipts are excluded."
          : categories.every((row) => row.value === 0) ? "No contributions reported"
          : "Signed adjustments — see profile"}
      </p>
      <dl className="card-loans">
        <div><dt>Candidate loans</dt><dd title={money(c.candidateLoans)}>{money(c.candidateLoans, true)}</dd></div>
      </dl>
      <details className="card-receipt-details">
        <summary>Other receipts & exact amounts</summary>
        <p className="card-detail-heading">Separate reported totals</p>
        <dl>
          {metrics.map((row) => (
            <div key={row.kind}>
              <dt>{row.label}</dt>
              <dd>{row.value === null ? "Not indexed" : money(row.value)}</dd>
            </div>
          ))}
        </dl>
        <p className="card-detail-heading">Campaign receipt breakdown</p>
        <dl>
          {[
            ...categories,
            { label: "Candidate loans", value: c.candidateLoans },
            { label: "Other loans", value: c.otherLoans },
            { label: "Transfers in", value: c.transfersIn },
            { label: "Remaining receipts (calculated)", value: remainder },
          ].map((row) => (
            <div key={row.label}><dt>{row.label}</dt><dd>{money(row.value)}</dd></div>
          ))}
        </dl>
        <p className="card-scope-note">
          Remaining receipts = reported receipts minus the contribution categories,
          loans and transfers shown here. It can include other receipts, source
          rounding or reporting differences; it is not a donor category.
        </p>
        <a href={fecUrl(c)} target="_blank" rel="noreferrer">FEC campaign summary ↗</a>
      </details>
      <div className="card-evidence-links">
        <Link href={`${profile}#donor-affiliations`} prefetch={false}>Donor employers ↗</Link>
        <Link href={`${profile}#funding-transparency`} prefetch={false}>Outside groups & disclosure gaps ↗</Link>
      </div>
    </div>
  );
}
