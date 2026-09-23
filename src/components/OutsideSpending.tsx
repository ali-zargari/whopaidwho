import Link from "next/link";
import { ArrowUpRight, Download } from "lucide-react";
import type { Candidate } from "@/lib/types";
import type { CandidateInfluence } from "@/lib/influence";
import { outsideSourceUrl } from "@/lib/influence";
import { contributionTotal, coverage, date, money, number } from "@/lib/format";
import OutsideNetwork from "./OutsideNetwork";

export default function OutsideSpending({
  name,
  candidate,
  data,
}: {
  name: string;
  candidate: Candidate | null;
  data: CandidateInfluence;
}) {
  const { outside, candidateId, cycle } = data;
  const direct = candidate ? contributionTotal(candidate) : null;
  const amounts = [
    {
      label: "Direct campaign contributions",
      value: direct,
      className: "direct",
      note: "Received by the campaign",
    },
    {
      label: "Outside spending for",
      value: outside.support,
      className: "support",
      note: "Spent to support this candidate",
    },
    {
      label: "Outside spending against",
      value: outside.oppose,
      className: "oppose",
      note: "Spent to oppose this candidate",
    },
  ];
  const maximum = Math.max(
    ...amounts.map((row) => Math.max(0, row.value ?? 0)),
    1,
  );
  return (
    <section
      className="panel influence-panel"
      id="outside-spending"
      aria-labelledby="outside-title"
    >
      <div className="panel-title">
        <div>
          <span className="eyebrow">
            BEYOND THE CAMPAIGN ACCOUNT · {cycle - 1}–{cycle}
          </span>
          <h2 id="outside-title">The outside money</h2>
        </div>
        <span className="dataset-badge">FEC processed filings</span>
      </div>
      <p className="influence-lead">
        See what the campaign received alongside money other groups spent to
        elect or defeat {name}.
      </p>
      <div className="influence-metrics">
        {amounts.map((row) => (
          <div className={`influence-metric ${row.className}`} key={row.label}>
            <span>{row.label}</span>
            <strong>
              {row.value === null ? "Not indexed" : money(row.value, true)}
            </strong>
            <p>{row.note}</p>
            <div className="influence-meter" aria-hidden="true">
              <i
                style={{
                  width: `${(Math.max(0, row.value ?? 0) / maximum) * 100}%`,
                }}
              />
            </div>
            <small>
              {row.value === null
                ? "Financial data unavailable"
                : money(row.value)}
            </small>
          </div>
        ))}
      </div>
      <p className="influence-source-note">
        Separate measures, not an additive total. Campaign:{" "}
        {candidate ? coverage(candidate).toLowerCase() : "summary unavailable"}.
        Outside spending: processed periodic filings retrieved{" "}
        {date(outside.downloadedAt)}; recent 24/48-hour notices may not yet
        appear. Amounts are net reported spending; negative amounts reflect
        reported adjustments.
      </p>
      {outside.status === "reported" ? (
        <OutsideNetwork
          key={`${candidateId}-${cycle}`}
          name={name}
          candidateId={candidateId}
          cycle={cycle}
          spenders={outside.spenders}
        />
      ) : (
        <div className="inline-empty">
          <h3>
            {outside.status === "not-indexed"
              ? "This candidate is not indexed for outside spending."
              : "No matching outside spending in the processed snapshot."}
          </h3>
          <p>
            Unreported activity and recent notices are outside this measure.
            This is not a finding of zero outside support or opposition.
          </p>
        </div>
      )}
      {outside.spenders.length > 0 && (
        <details className="influence-ledger">
          <summary>
            All {number(outside.spenders.length)} outside spenders · exact
            amounts & sources
          </summary>
          <div className="table-scroll">
            <table className="records-table">
              <caption className="sr-only">
                Outside spending by group for {name}, {cycle}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Spender</th>
                  <th scope="col" className="number-cell">
                    Supports
                  </th>
                  <th scope="col" className="number-cell">
                    Opposes
                  </th>
                  <th scope="col">Source</th>
                </tr>
              </thead>
              <tbody>
                {outside.spenders.map((s) => (
                  <tr key={s.id}>
                    <td>
                      {s.name}
                      <span className="record-meta">{s.id}</span>
                    </td>
                    <td className="number-cell">{money(s.support)}</td>
                    <td className="number-cell">{money(s.oppose)}</td>
                    <td>
                      <a
                        className="filing-link"
                        href={outsideSourceUrl(candidateId, cycle, s.id)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        FEC records <ArrowUpRight size={13} />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
      <div className="influence-actions">
        <a href={outside.sourceUrl} target="_blank" rel="noreferrer">
          Explore FEC outside spending <ArrowUpRight size={15} />
        </a>
        <a
          href={`/api/influence?cid=${candidateId}&cycle=${cycle}`}
          download={`${candidateId}-${cycle}-funding.json`}
        >
          <Download size={15} /> Download funding data
        </a>
        <Link href="/methodology#outside">
          How these totals are calculated ↗
        </Link>
      </div>
    </section>
  );
}
