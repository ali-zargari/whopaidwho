import Link from "next/link";
import { ArrowUpRight, FileSearch } from "lucide-react";
import {
  candidateCases,
  CASE_STATUSES,
  type AccountabilityCase,
} from "@/lib/accountability";
import { date, money } from "@/lib/format";
import { CYCLES, getCandidate } from "@/lib/data";
import { candidateEnforcement, enforcement } from "@/lib/enforcement";
import EnforcementRecord from "./EnforcementRecord";

export function CaseCard({
  record,
  cycle,
  showCandidate = false,
}: {
  record: AccountabilityCase;
  cycle: number;
  showCandidate?: boolean;
}) {
  const status = CASE_STATUSES[record.status];
  const profileCycle = getCandidate(record.candidateId, cycle)
    ? cycle
    : CYCLES.find((y) => getCandidate(record.candidateId, y));
  return (
    <article className={`case-card ${status.tone}`} id={record.id}>
      <header className="case-card-heading">
        <div>
          {showCandidate && (
            <Link
              className="case-candidate"
              href={`/candidate/${record.candidateId}?cycle=${profileCycle}#accountability`}
            >
              {record.candidateName}
              {profileCycle !== cycle && (
                <small> · {profileCycle} financial profile</small>
              )}
              <ArrowUpRight size={14} />
            </Link>
          )}
          <span className="case-authority">
            {record.authority} · {record.caseNumber}
          </span>
          <h3>{record.title}</h3>
        </div>
        <span className={`case-status ${status.tone}`}>{status.label}</span>
      </header>
      <dl className="case-meta">
        <div>
          <dt>Action date</dt>
          <dd>{date(record.eventDate)}</dd>
        </div>
        <div>
          <dt>Conduct period</dt>
          <dd>{record.conductPeriod}</dd>
        </div>
        <div>
          <dt>Who the record concerns</dt>
          <dd>{record.respondent}</dd>
        </div>
      </dl>
      <div className="case-evidence">
        <div>
          <h4>Conduct described in the record</h4>
          <p>{record.conduct}</p>
        </div>
        <div className="case-outcome">
          <h4>Outcome / procedural status</h4>
          <p>{record.outcome}</p>
        </div>
      </div>
      {record.penalty !== undefined && (
        <p className="case-penalty">
          <strong>{money(record.penalty)}</strong>
          <span>{record.penaltyLabel}</span>
        </p>
      )}
      <p className="case-context">{record.context}</p>
      <details className="case-status-explainer">
        <summary>What “{status.label.toLowerCase()}” means</summary>
        <p>{status.definition}</p>
      </details>
      <footer className="case-sources">
        <div>
          {record.sources.map((s) => (
            <a key={s.url} href={s.url} target="_blank" rel="noreferrer">
              {s.label}
              <ArrowUpRight size={13} />
            </a>
          ))}
        </div>
        <span>
          Sources reviewed {date(record.reviewedAt)} · selected records
        </span>
      </footer>
    </article>
  );
}

export default function AccountabilityPanel({
  candidateId,
  name,
  cycle,
}: {
  candidateId: string;
  name: string;
  cycle: number;
}) {
  const cases = candidateCases(candidateId);
  const fec = candidateEnforcement(candidateId);
  return (
    <section
      className="accountability-panel"
      id="accountability"
      aria-labelledby="accountability-heading"
    >
      <div className="panel-title">
        <div>
          <span className="eyebrow">BEYOND THE FUNDING TOTAL</span>
          <h2 id="accountability-heading">Accountability record</h2>
        </div>
        <FileSearch size={26} />
      </div>
      <p className="accountability-intro">
        The same FEC committee-name lookup runs for every candidate, including{" "}
        {name}. Records span years beyond the {cycle} funding cycle. Campaign
        respondents and personal conduct are identified separately.
      </p>
      <p className="coverage-label">
        {enforcement.candidatesChecked.toLocaleString("en-US")} candidates
        checked · {enforcement.casesScanned.toLocaleString("en-US")} FEC case
        titles scanned · retrieved {date(enforcement.downloadedAt)} · limited
        name matching
      </p>
      <div className="accountability-subheading">
        <h3>FEC enforcement records</h3>
        <span>
          {fec.length} linked case {fec.length === 1 ? "number" : "numbers"} ·
          not a conduct score
        </span>
      </div>
      {fec.length ? (
        <>
          <div className="case-list">
            {fec.slice(0, 2).map((c) => (
              <EnforcementRecord
                key={c.number}
                record={c}
                candidateId={candidateId}
                cycle={cycle}
              />
            ))}
          </div>
          {fec.length > 2 && (
            <Link
              className="secondary-button enforcement-more"
              href={`/accountability?cycle=${cycle}&q=${candidateId}`}
            >
              Read all {fec.length} linked FEC case numbers ↗
            </Link>
          )}
        </>
      ) : (
        <div className="accountability-unreviewed">
          <strong>
            No FEC case title matched this campaign’s linked committee names.
          </strong>
          <p>
            This search can miss secondary respondents, renamed committees,
            archived files, and personal cases. It does not cover every FEC
            enforcement program, criminal court, or ethics investigation. No
            match is not a clean bill of health.
          </p>
        </div>
      )}
      <div className="accountability-subheading">
        <h3>Reviewed investigations & context</h3>
        <span>Supplementary source review</span>
      </div>
      {cases.length ? (
        <>
          <p className="coverage-label">
            Partial review · includes broader investigations and context for
            selected FEC matters above · do not add these counts together
          </p>
          <div className="case-list">
            {cases.map((c) => (
              <CaseCard key={c.id} record={c} cycle={cycle} />
            ))}
          </div>
        </>
      ) : (
        <div className="accountability-unreviewed">
          <strong>
            Broader investigations and case narratives have not been reviewed
            for this candidate.
          </strong>
          <p>
            This is a coverage gap, not a finding about their conduct. The same
            source standards apply to every candidate.
          </p>
        </div>
      )}
      <div className="accountability-panel-footer">
        <Link href={`/accountability?cycle=${cycle}`}>
          Browse investigations & findings
          <ArrowUpRight size={14} />
        </Link>
        <Link href="/methodology#accountability">
          Sources, review scope & corrections
          <ArrowUpRight size={14} />
        </Link>
      </div>
    </section>
  );
}
