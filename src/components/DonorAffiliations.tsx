import { ArrowUpRight } from "lucide-react";
import type { CandidateInfluence, AffiliationRow } from "@/lib/influence";
import { affiliationSourceUrl } from "@/lib/influence";
import { date, money, number } from "@/lib/format";

function AffiliationTable({
  rows,
  label,
  remainder,
  missing,
  committees,
  cycle,
  kind,
}: {
  rows: AffiliationRow[];
  label: string;
  remainder: number;
  missing: number;
  committees: string[];
  cycle: number;
  kind: "employer" | "occupation";
}) {
  return (
    <div className="affiliation-column">
      <h3>{label}</h3>
      <p>As reported by individual contributors</p>
      <div className="table-scroll">
        <table className="records-table affiliation-table">
          <caption className="sr-only">{label} of individual donors</caption>
          <thead>
            <tr>
              <th scope="col">Reported {kind}</th>
              <th scope="col" className="number-cell">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 10).map((row) => (
              <tr key={row.name}>
                <td>
                  <a
                    href={affiliationSourceUrl(
                      committees,
                      cycle,
                      kind,
                      row.name,
                    )}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {row.name} <ArrowUpRight size={12} />
                  </a>
                  <span className="record-meta">
                    {number(row.count)} records
                  </span>
                </td>
                <td className="number-cell">{money(row.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Other reported values</th>
              <td className="number-cell">
                {money(
                  remainder +
                    rows.slice(10).reduce((sum, row) => sum + row.amount, 0),
                )}
              </td>
            </tr>
            <tr>
              <th scope="row">Missing / not provided</th>
              <td className="number-cell">{money(missing)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export default function DonorAffiliations({
  data,
}: {
  data: CandidateInfluence;
}) {
  const { record, downloadedAt, sourceLastModified } = data.affiliations;
  return (
    <section
      className="panel influence-panel"
      id="donor-affiliations"
      aria-labelledby="affiliation-title"
    >
      <div className="panel-title">
        <div>
          <span className="eyebrow">INSIDE INDIVIDUAL DONATIONS</span>
          <h2 id="affiliation-title">Who do individual donors work for?</h2>
        </div>
        <span className="dataset-badge">Reported affiliations</span>
      </div>
      <p className="influence-lead">
        A personal check can come from an executive, a nurse, or a retiree.
        Employer and occupation disclosures add context to the
        individual-donation category.
      </p>
      {record?.status === "available" ? (
        <>
          <div className="affiliation-summary">
            <div>
              <strong>{money(record.amount, true)}</strong>
              <span>Included itemized records · signed total</span>
            </div>
            <div>
              <strong>{number(record.count)}</strong>
              <span>Contribution records, not unique people</span>
            </div>
            <div>
              <strong>{date(record.dateThrough)}</strong>
              <span>Latest included transaction date</span>
            </div>
          </div>
          <div className="callout">
            <p>
              These are individuals’ personal donations. An employer name does
              not mean the company paid, directed, or endorsed the contribution.
              Occupations are reported text, not a verified executive or
              lobbyist registry.
            </p>
          </div>
          <details className="influence-ledger" open>
            <summary>Explore employers and occupations</summary>
            <div className="affiliation-columns">
              <AffiliationTable
                rows={record.employers}
                label="Employers"
                kind="employer"
                remainder={record.otherEmployerAmount}
                missing={record.missingEmployerAmount}
                committees={record.committees}
                cycle={data.cycle}
              />
              <AffiliationTable
                rows={record.occupations}
                label="Occupations"
                kind="occupation"
                remainder={record.otherOccupationAmount}
                missing={record.missingOccupationAmount}
                committees={record.committees}
                cycle={data.cycle}
              />
            </div>
          </details>
          <p className="panel-note">
            Top reported values in the included itemized records; spelling
            variants can appear separately. These are two views of the same
            money and must not be added together. Positive entries:{" "}
            {money(record.positiveAmount)}; negative adjustments:{" "}
            {money(record.negativeAmount)}. Unitemized donations have no
            employer or occupation breakdown here.{" "}
            <a href="/methodology#affiliations">
              Read coverage and exclusions ↗
            </a>
          </p>
        </>
      ) : (
        <div className="inline-empty">
          <h3>
            {!record
              ? "Affiliation matching has not run for this candidate."
              : record.status === "no-committee-link"
                ? "No usable campaign committee link in this snapshot."
                : "No eligible individual records matched."}
          </h3>
          <p>
            Missing affiliations do not establish grassroots funding or an
            absence of executive or industry support.
          </p>
        </div>
      )}
      <p className="influence-source-note">
        FEC snapshot retrieved {date(downloadedAt)}
        {sourceLastModified
          ? ` · Source archive last updated ${date(new Date(sourceLastModified).toISOString())}`
          : ""}
        .{" "}
        {record?.committees.length
          ? `${number(record.committees.length)} campaign committee${record.committees.length === 1 ? "" : "s"} linked by FEC ID.`
          : ""}{" "}
        <a href="/methodology#affiliations">Methodology ↗</a>
      </p>
    </section>
  );
}
