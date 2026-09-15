import { money, contributionTotal } from "@/lib/format";
import type { Candidate } from "@/lib/types";
export default function FundingBreakdown({
  candidate: c,
}: {
  candidate: Candidate;
}) {
  const total = contributionTotal(c);
  const segments = [
    { label: "Individuals", value: c.individuals, color: "#176850" },
    {
      label: "Other political committees",
      value: c.committees,
      color: "#748fca",
    },
    { label: "The candidate", value: c.selfContributions, color: "#be914e" },
    {
      label: "Party committees",
      value: c.partyContributions,
      color: "#99af9b",
    },
  ];
  const canChart = total > 0 && segments.every((s) => s.value >= 0);
  return (
    <section className="panel funding-panel">
      <div className="panel-title">
        <div>
          <span className="eyebrow">WHERE CONTRIBUTIONS COME FROM</span>
          <h2>The funding mix</h2>
        </div>
      </div>
      <div className="breakdown-total">
        <strong>{money(total)}</strong>
        <span>Total reported contributions</span>
      </div>
      {canChart ? (
        <div
          className="stacked-bar"
          role="img"
          aria-label={segments
            .map((s) => `${s.label}: ${money(s.value)}`)
            .join("; ")}
        >
          {segments.map((s) => (
            <span
              key={s.label}
              style={{
                width: `${(s.value / total) * 100}%`,
                background: s.color,
              }}
            />
          ))}
        </div>
      ) : (
        <p className="muted-text">
          {total === 0
            ? "No contributions reported."
            : "Signed adjustments are shown in the table below."}
        </p>
      )}
      <div className="breakdown-rows">
        {segments.map((s) => (
          <div key={s.label}>
            <span>
              <i style={{ background: s.color }} />
              {s.label}
            </span>
            <strong>{money(s.value)}</strong>
            <span>
              {canChart ? `${((s.value / total) * 100).toFixed(1)}%` : "—"}
            </span>
          </div>
        ))}
      </div>
      {c.itemized !== null && c.unitemized !== null && (
        <div className="individual-detail">
          <h3>Inside individual contributions</h3>
          <div>
            <span>Itemized</span>
            <strong>{money(c.itemized)}</strong>
          </div>
          <div>
            <span>Unitemized</span>
            <strong>{money(c.unitemized)}</strong>
          </div>
          <p>
            Unitemized is a disclosure category, not a count of small donors.
          </p>
        </div>
      )}
      <p className="panel-note">
        Contributions exclude loans, transfers, and other receipts. Committee
        contributions include PACs and other political committees.{" "}
        <a href="/methodology#definitions">See definitions ↗</a>
      </p>
    </section>
  );
}
