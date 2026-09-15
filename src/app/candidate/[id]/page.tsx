import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  Download,
  FileText,
  Info,
  Scale,
} from "lucide-react";
import {
  getCandidate,
  parseFilters,
  toParams,
  snapshot,
  CYCLES,
} from "@/lib/data";
import { committeeRecords } from "@/lib/records";
import {
  coverage,
  date,
  money,
  partyName,
  partyClass,
  initials,
  STATES,
  officeLabel,
  fecUrl,
} from "@/lib/format";
import ShareButton from "@/components/ShareButton";
import AccountabilityPanel from "@/components/AccountabilityPanel";
import FundingBreakdown from "@/components/FundingBreakdown";
type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const { id } = await params;
  const { cycle } = parseFilters(toParams(await searchParams));
  const c = getCandidate(id, cycle);
  return {
    title: c ? `${c.name} · ${cycle} campaign finance` : "Candidate not found",
    description: c
      ? `Explore ${c.name}'s reported campaign receipts, contributions and committee records for ${cycle - 1}–${cycle}.`
      : undefined,
  };
}
export default async function CandidatePage({ params, searchParams }: Props) {
  const { id } = await params;
  const { cycle } = parseFilters(toParams(await searchParams));
  const c = getCandidate(id, cycle);
  if (!c) notFound();
  const records = await committeeRecords(id, cycle);
  const data = snapshot(cycle);
  const alternate = CYCLES.find((y) => y !== cycle && getCandidate(id, y));
  const other = alternate ? getCandidate(id, alternate) : undefined;
  return (
    <main id="main" className="page-shell detail-shell">
      <Link href={`/?cycle=${cycle}`} className="back-link">
        <ArrowLeft size={15} />
        Explore candidates
      </Link>
      <section className="profile-heading">
        <div className={`avatar profile-avatar ${partyClass(c.party)}`}>
          {initials(c.name)}
        </div>
        <div className="profile-identity">
          <div className="profile-tags">
            <span className={`party-badge ${partyClass(c.party)}`}>
              {partyName(c.party)}
            </span>
            <span>
              {STATES[c.state] || c.state} · {officeLabel(c)}
            </span>
          </div>
          <h1>{c.name}</h1>
          <p>
            FEC candidate {c.id} <span>·</span> {cycle - 1}–{cycle} reporting
            period
          </p>
        </div>
        <div className="profile-actions">
          <ShareButton />
          <a
            className="primary-button"
            href={fecUrl(c)}
            target="_blank"
            rel="noreferrer"
          >
            View on FEC
            <ArrowUpRight size={16} />
          </a>
        </div>
      </section>
      <div className="profile-notice">
        <Info size={16} />
        <span>
          {coverage(c)}. Snapshot downloaded {date(data.downloadedAt)}.
        </span>
        {other && (
          <Link href={`/candidate/${id}?cycle=${alternate}`}>
            View {alternate} cycle <ArrowRightIcon />
          </Link>
        )}
      </div>
      <AccountabilityPanel candidateId={c.id} name={c.name} cycle={cycle} />
      <div className="financial-stats">
        {[
          [
            "Reported receipts",
            c.receipts,
            "All incoming funds, including transfers",
          ],
          [
            "Reported spending",
            c.disbursements,
            "Disbursements, including transfers",
          ],
          ["Cash on hand", c.cash, "At the end of the reporting period"],
          ["Debts owed", c.debt, "Outstanding reported obligations"],
        ].map(([label, amount, note]) => (
          <div key={String(label)}>
            <span>{label}</span>
            <strong>{money(Number(amount), true)}</strong>
            <p>{note}</p>
          </div>
        ))}
      </div>
      <div className="profile-panels">
        <FundingBreakdown candidate={c} />
        <section className="panel">
          <span className="eyebrow">BEYOND CONTRIBUTIONS</span>
          <h2>Loans, transfers & refunds</h2>
          <p className="muted-text">
            These categories help explain why total receipts differ from
            contributions.
          </p>
          <dl className="ledger">
            {[
              ["Transfers from authorized committees", c.transfersIn],
              ["Candidate loans", c.candidateLoans],
              ["Other loans", c.otherLoans],
              ["Transfers to authorized committees", c.transfersOut],
              ["Individual contribution refunds", c.individualRefunds],
              ["Committee contribution refunds", c.committeeRefunds],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <dt>{label}</dt>
                <dd>{money(Number(value))}</dd>
              </div>
            ))}
          </dl>
          <div className="callout">
            <Info size={17} />
            <p>
              Receipts and spending can include money moved between a
              candidate’s own committees. Refunds are listed separately;
              contributions above are gross reported amounts.
            </p>
          </div>
        </section>
      </div>
      <section className="panel records-panel">
        <div className="panel-title">
          <div>
            <span className="eyebrow">FOLLOW THE PAPER TRAIL</span>
            <h2>Committee contribution records</h2>
          </div>
          <FileText size={23} />
        </div>
        <p className="records-description">
          The latest matching record from each of up to 12 committees, ordered
          by transaction date. Each amount is a single reported transaction,{" "}
          <strong>not that committee’s total giving.</strong> Filings may
          include amendments, memo entries, and negative adjustments.
        </p>
        {records.records.length ? (
          <div className="table-scroll">
            <table className="records-table">
              <caption className="sr-only">
                Recent committee contribution records for {c.name}
              </caption>
              <thead>
                <tr>
                  <th>Reporting committee</th>
                  <th>Transaction date</th>
                  <th className="number-cell">Amount</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {records.records.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <a
                        href={`https://www.fec.gov/data/committee/${r.committeeId}/?cycle=${cycle}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {r.name}
                        <ArrowUpRight size={13} />
                      </a>
                      <span className="record-meta">
                        {r.committeeId} → {r.recipientId}
                        {r.type === "24Z" ? " · In-kind" : ""}
                        {r.isMemo ? " · Memo entry" : ""}
                        {r.amendment === "A" ? " · Amended filing" : ""}
                        {r.amount < 0 ? " · Negative adjustment" : ""}
                      </span>
                      {r.memo && (
                        <details className="memo-details">
                          <summary>Filing note</summary>
                          <p>{r.memo}</p>
                        </details>
                      )}
                    </td>
                    <td>{date(r.date)}</td>
                    <td className="number-cell">
                      <strong>{money(r.amount)}</strong>
                    </td>
                    <td>
                      <a
                        className="filing-link"
                        href={`https://www.fec.gov/data/filings/?file_number=${encodeURIComponent(r.fileNumber)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Filing
                        <ArrowUpRight size={13} />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="inline-empty">
            <FileText size={24} />
            <h3>No matching committee records in this snapshot.</h3>
            <p>
              This does not mean the campaign received no committee support.
              Candidate and committee disclosures use different reporting
              records.
            </p>
            <a href={fecUrl(c)} target="_blank" rel="noreferrer">
              Review the candidate’s FEC filings ↗
            </a>
          </div>
        )}
        <p className="panel-note">
          Source: FEC committee-to-candidate files, downloaded{" "}
          {date(records.downloadedAt)}. Reporting committee names come from the
          committee registry. These records exclude independent expenditures and
          do not reconcile to candidate-reported receipts.{" "}
          <Link href="/methodology#records">Selection methodology ↗</Link>
        </p>
      </section>
      <div className="detail-bottom">
        <Link
          className="secondary-button"
          href={`/compare?cycle=${cycle}&ids=${id}`}
        >
          <Scale size={17} />
          Compare this candidate
        </Link>
        <a className="text-button" href={`/api/export?cycle=${cycle}&q=${id}`}>
          <Download size={16} />
          Download financial summary
        </a>
      </div>
    </main>
  );
}
function ArrowRightIcon() {
  return <span aria-hidden="true">→</span>;
}
