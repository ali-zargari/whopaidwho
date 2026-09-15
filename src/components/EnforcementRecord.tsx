import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { EnforcementCase } from "@/lib/enforcement";
import { candidateProfile } from "@/lib/enforcement";
import { date } from "@/lib/format";

export default function EnforcementRecord({
  record,
  candidateId,
  cycle,
}: {
  record: EnforcementCase;
  candidateId?: string;
  cycle: number;
}) {
  const matches = record.matches.filter(
    (m) => !candidateId || m.candidateId === candidateId,
  );
  const groups = record.dispositions.filter((d) =>
    candidateId
      ? d.matchedCandidateIds.includes(candidateId)
      : d.matchedCandidateIds.length > 0,
  );
  const grouped = new Map<
    string,
    { dispositions: string[]; penalty: string | null; respondents: string[] }
  >();
  for (const g of groups) {
    const key = JSON.stringify([g.penalty, [...g.respondents].sort()]);
    const item = grouped.get(key) || {
      dispositions: [],
      penalty: g.penalty,
      respondents: g.respondents,
    };
    if (!item.dispositions.includes(g.disposition))
      item.dispositions.push(g.disposition);
    grouped.set(key, item);
  }
  const documents = record.documents
    .filter((d) =>
      ["Conciliation and Settlement Agreements", "Certifications"].includes(
        d.category,
      ),
    )
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  return (
    <article className="enforcement-record">
      <header>
        <div>
          <span className="eyebrow">FEC · PUBLISHED CASE RECORD</span>
          <h3>
            <a href={record.url} target="_blank" rel="noreferrer">
              MUR {record.number} · {record.name}
              <ArrowUpRight size={16} />
            </a>
          </h3>
        </div>
        <span>
          Latest document
          <br />
          <strong>{date(record.latestDocumentDate)}</strong>
        </span>
      </header>
      <div className="enforcement-match">
        {matches.map((m) => {
          const candidate = candidateProfile(m.candidateId, cycle);
          return (
            <p key={`${m.candidateId}-${m.committeeId}`}>
              <strong>Campaign respondent:</strong> {m.committeeName}{" "}
              <a
                href={`https://www.fec.gov/data/committee/${m.committeeId}/`}
                target="_blank"
                rel="noreferrer"
              >
                {m.committeeId} ↗
              </a>
              {!candidateId && candidate && (
                <>
                  {" "}
                  ·{" "}
                  <Link
                    href={`/candidate/${candidate.id}?cycle=${candidate.cycle}#accountability`}
                  >
                    {candidate.name} ↗
                  </Link>
                </>
              )}
            </p>
          );
        })}
        <small>
          Matched by complete committee name, verified against the case
          respondent list. The legal index itself does not supply candidate IDs.
        </small>
      </div>
      <div className="enforcement-outcomes">
        {[...grouped.values()].map((g, i) => (
          <div key={i}>
            <div>
              {g.dispositions.map((d) => (
                <h4 key={d}>{d}</h4>
              ))}
              <p>
                Respondent{g.respondents.length === 1 ? "" : "s"}:{" "}
                {g.respondents.join("; ")}
              </p>
            </div>
            {g.penalty && (
              <p className="enforcement-amount">
                <strong>{g.penalty}</strong>
                <span>Penalty shown for this respondent group</span>
              </p>
            )}
          </div>
        ))}
      </div>
      {record.relatedMatters.length > 1 && (
        <p className="enforcement-caveat">
          <strong>Joint action references: </strong>
          {record.relatedMatters.map((n, i) => (
            <span key={n}>
              {i > 0 ? ", " : ""}
              <a
                href={`https://www.fec.gov/data/legal/matter-under-review/${n}/`}
                target="_blank"
                rel="noreferrer"
              >
                MUR {n}
              </a>
            </span>
          ))}
          . These case numbers may describe the same proceeding and penalty.
        </p>
      )}
      <p className="enforcement-caveat">
        These are the FEC’s disposition labels. Closing a file does not
        establish guilt; a “reason to believe” decision is a procedural
        threshold. Repeated amounts for the same respondent group are shown
        once. Amounts across case numbers can overlap and must not be added.
      </p>
      <details className="enforcement-documents">
        <summary>Read the decision and source documents</summary>
        <ul>
          {documents.slice(0, 8).map((d) => (
            <li key={d.url}>
              <a href={d.url} target="_blank" rel="noreferrer">
                {d.category} · {date(d.date)} · {d.label} ↗
              </a>
            </li>
          ))}
        </ul>
        <a href={record.url} target="_blank" rel="noreferrer">
          All documents and Commission votes ↗
        </a>
        <p>
          Source retrieved {date(record.source.fetchedAt)}. This index does not
          review later litigation, reopening, or enforcement of the agreement.
        </p>
      </details>
    </article>
  );
}
