import { ArrowRight, ArrowUpRight, ShieldQuestion } from "lucide-react";
import type { CandidateInfluence, FundingDonor } from "@/lib/influence";
import { date, money, number } from "@/lib/format";

function DisclosureLabel({ donor }: { donor: FundingDonor }) {
  if (donor.nonprofit)
    return (
      <span className="disclosure-label nonprofit">
        IRS-listed nonprofit · 501(c)({Number(donor.nonprofit.subsection)})
      </span>
    );
  if (donor.disclosure === "fec-committee")
    return <span className="disclosure-label">FEC committee</span>;
  return (
    <span className="disclosure-label">Organization reported by filer</span>
  );
}

export default function FundingTransparency({
  data,
}: {
  data: CandidateInfluence;
}) {
  const { fundingLinks, outside, cycle } = data;
  const matched = outside.spenders
    .map((s) => ({ spender: s, links: fundingLinks.committees[s.id] }))
    .filter((s) => s.links && s.links.donors.length > 0);
  const nonprofitCount = new Set(
    matched.flatMap((s) =>
      s.links!.donors.filter((d) => d.nonprofit).map((d) => d.nonprofit!.ein),
    ),
  ).size;
  return (
    <section
      className="panel influence-panel transparency-panel"
      id="funding-transparency"
      aria-labelledby="transparency-title"
    >
      <div className="panel-title">
        <div>
          <span className="eyebrow">FOLLOW ANOTHER STEP</span>
          <h2 id="transparency-title">Outside groups have backers, too.</h2>
        </div>
        <ShieldQuestion size={28} aria-hidden="true" />
      </div>
      <p className="influence-lead">
        Large disclosed receipts can connect an outside spender to another
        organization. Some trails end at a nonprofit whose original donors may
        not be identifiable from these records.
      </p>
      <div className="transparency-scope">
        <strong>
          {money(fundingLinks.coverage.minimumReceiptAmount, true)}+ receipt
          search
        </strong>
        <span>
          Each qualifying receipt meets this threshold. Smaller receipts and
          individual donors are outside this view.
        </span>
      </div>
      {fundingLinks.coverage.status === "partial-query" && (
        <p className="coverage-warning">
          Partial import: {number(fundingLinks.coverage.importedRecordCount)}{" "}
          matching records retrieved
          {fundingLinks.coverage.sourceRecordCount === null
            ? "; source total unavailable"
            : ` of ${number(fundingLinks.coverage.sourceRecordCount)}`}
          . Additional connections may be missing.
        </p>
      )}
      {outside.status === "not-indexed" ? (
        <div className="inline-empty">
          <h3>
            Outside-spender coverage unavailable for this candidate and cycle.
          </h3>
          <p>
            Funding connections cannot be assessed without an indexed
            outside-spender record.
          </p>
        </div>
      ) : matched.length > 0 ? (
        <>
          <p className="transparency-count">
            {number(matched.length)} outside spender
            {matched.length === 1 ? "" : "s"} with qualifying organization
            receipts
            {nonprofitCount > 0
              ? ` · ${number(nonprofitCount)} recipient-reported backer${nonprofitCount === 1 ? "" : "s"} matched to the IRS nonprofit register`
              : ""}
            .
          </p>
          <div className="funding-paths">
            {matched.map(({ spender, links }) => (
              <details className="funding-path" key={spender.id}>
                <summary>
                  <span>
                    <strong>{spender.name}</strong>
                    <small>
                      {number(links!.donors.length)} funding entr
                      {links!.donors.length === 1 ? "y" : "ies"} in this search
                    </small>
                  </span>
                  <span className="funding-path-spending">
                    {money(spender.support, true)} for ·{" "}
                    {money(spender.oppose, true)} against
                  </span>
                </summary>
                <div className="funding-path-intro">
                  <span>Reported backer</span>
                  <ArrowRight size={16} aria-hidden="true" />
                  <span>{spender.name}</span>
                </div>
                {links!.donors.map((d, index) => (
                  <article
                    className="upstream-donor"
                    key={`${d.id || d.name}-${d.kind}-${index}`}
                  >
                    <div className="upstream-donor-heading">
                      <div>
                        <h3>{d.name}</h3>
                        <DisclosureLabel donor={d} />
                      </div>
                      <div>
                        <strong>{money(d.amount)}</strong>
                        <small>
                          {number(d.receiptCount)} qualifying receipt
                          {d.receiptCount === 1 ? "" : "s"}
                        </small>
                      </div>
                    </div>
                    <p className="upstream-kind">
                      {d.kind.replaceAll("-", " ")} · Amount received by the
                      outside group, not attributed to this candidate.
                    </p>
                    {d.nonprofit && (
                      <p className="nonprofit-note">
                        Matched to the current IRS register by name and location
                        (EIN {d.nonprofit.ein}). This does not establish
                        historical tax status, original donors, or a
                        candidate-specific dark-money amount.
                      </p>
                    )}
                    <div className="upstream-source-links">
                      <a href={d.sourceUrl} target="_blank" rel="noreferrer">
                        Reported receipts <ArrowUpRight size={13} />
                      </a>
                      {d.classificationProofURLs.map((url, i) => (
                        <a
                          href={url}
                          key={url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {d.nonprofit
                            ? "IRS source & disclosure context"
                            : "Identity source"}
                          {d.classificationProofURLs.length > 1
                            ? ` ${i + 1}`
                            : ""}{" "}
                          <ArrowUpRight size={13} />
                        </a>
                      ))}
                    </div>
                    <details className="receipt-details">
                      <summary>
                        Receipt dates, filing categories & original records
                      </summary>
                      <ul>
                        {d.records.map((r) => (
                          <li key={r.subId}>
                            <a
                              href={r.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {date(r.date)} · {money(r.amount)} · {r.lineLabel}{" "}
                              ↗
                            </a>
                          </li>
                        ))}
                      </ul>
                    </details>
                  </article>
                ))}
              </details>
            ))}
          </div>
        </>
      ) : (
        <div className="inline-empty">
          <h3>No qualifying funding links matched in this snapshot.</h3>
          <p>
            This search is limited to large reported organization receipts. It
            does not establish that the spender’s funding is fully disclosed.
          </p>
        </div>
      )}
      <details className="dark-money-disclaimer" open>
        <summary>What this reveals about dark money</summary>
        <p>
          Outside spending is not automatically dark money. A Super PAC must
          disclose reportable donors, but a named donor may itself receive funds
          from undisclosed sources. Public filings cannot always identify the
          original person or organization behind the money.
        </p>
        <p>
          We show documented receipts and independently matched nonprofit
          identities. We do not assign an outside group’s incoming money to a
          particular candidate or calculate a hidden-money total. Groups can
          fund multiple races, retain funds, or use receipts for other purposes.
          Original donors: not determined.
        </p>
        <a href="/methodology#funding-links">
          Read the matching rules and disclosure limits ↗
        </a>
      </details>
      <p className="influence-source-note">
        {cycle - 1}–{cycle} receipts · Retrieved{" "}
        {date(fundingLinks.downloadedAt)}. Source coverage and transaction
        categories can differ from outside-spending totals.
      </p>
    </section>
  );
}
