import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, ArrowUpRight, Database } from "lucide-react";
import { snapshot, CYCLES } from "@/lib/data";
import { date, number } from "@/lib/format";
export const metadata: Metadata = { title: "Sources & methodology" };
export default function Methodology() {
  return (
    <main id="main" className="page-shell methodology-page">
      <Link href="/" className="back-link">
        <ArrowLeft size={15} />
        Explore candidates
      </Link>
      <span className="eyebrow">TRANSPARENCY STARTS HERE</span>
      <h1>
        Show your sources.
        <br />
        Explain your numbers.
      </h1>
      <p className="methodology-lead">
        Who Paid Who makes public campaign filings easier to explore. Every
        financial figure comes from the Federal Election Commission. We do not
        infer a politician’s motives from their funding.
      </p>
      <div className="methodology-layout">
        <nav className="methodology-nav" aria-label="Methodology sections">
          <a href="#sources">01 · Sources & freshness</a>
          <a href="#coverage">02 · What’s covered</a>
          <a href="#definitions">03 · Reading the numbers</a>
          <a href="#records">04 · Committee records</a>
          <a href="#company-graph">05 · Company funding graph</a>
          <a href="#outside">06 · Outside & dark money</a>
          <a href="#limits">07 · Limits & corrections</a>
        </nav>
        <div className="methodology-content">
          <section id="sources">
            <span className="eyebrow">01 / SOURCES & FRESHNESS</span>
            <h2>Official records, saved as snapshots.</h2>
            <p>
              The explorer uses the FEC’s all-candidates financial summary
              files. It enriches individual itemization from the
              candidate-summary CSV only when both the reporting date and
              individual contribution total agree. Download timestamps describe
              when we retrieved a file; each candidate’s coverage date describes
              the end of their reported financial period.
            </p>
            <div className="source-cards">
              {CYCLES.map((cycle) => {
                const data = snapshot(cycle);
                return (
                  <a
                    className="source-card"
                    key={cycle}
                    href={data.source}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Database size={20} />
                    <div>
                      <strong>
                        {cycle - 1}–{cycle} FEC snapshot
                      </strong>
                      <span>
                        {number(data.candidates.length)} congressional
                        candidates · Downloaded {date(data.downloadedAt)}
                      </span>
                    </div>
                    <ArrowUpRight size={18} />
                  </a>
                );
              })}
            </div>
            <p>
              These are saved records, not a live feed. The FEC may revise or
              amend filings after our download. Coverage dates after the
              retrieval date are flagged as source anomalies; they do not
              establish a completed reporting period. Follow the candidate’s FEC
              link for current disclosures.
            </p>
          </section>
          <section id="coverage">
            <span className="eyebrow">02 / COVERAGE</span>
            <h2>Campaign activity, not a congressional roster.</h2>
            <p>
              We include House and Senate candidates present in the FEC
              all-candidates file for the selected two-year period. This can
              include former candidates and candidates not standing for election
              during that cycle. It does not establish whether someone currently
              holds office. We exclude presidential, state, and local campaigns.
            </p>
            <p>
              FEC candidate IDs identify candidates across reporting periods.
              Party, state, and district are as recorded in the source snapshot.
              An absent record is not evidence of zero fundraising.
            </p>
          </section>
          <section id="definitions">
            <span className="eyebrow">03 / DEFINITIONS</span>
            <h2>Different kinds of money.</h2>
            <dl className="definitions">
              <div>
                <dt>Reported receipts</dt>
                <dd>
                  All reported incoming funds: contributions, loans, transfers
                  from other authorized committees, and other receipts. This is
                  not the same as donations.
                </dd>
              </div>
              <div>
                <dt>Contributions</dt>
                <dd>
                  The sum of individuals, other political committees, party
                  committees, and the candidate’s direct contributions.
                  Candidate loans are separate. Refunds are shown separately
                  from gross contributions.
                </dd>
              </div>
              <div>
                <dt>Individual contributions</dt>
                <dd>
                  Money reported as coming from individuals. The funding bar
                  divides this by total contributions, not total receipts. An
                  employer is not treated as the donor of an employee’s money.
                </dd>
              </div>
              <div>
                <dt>Itemized and unitemized</dt>
                <dd>
                  FEC disclosure categories. Unitemized contributions cannot
                  establish a count of unique donors or a total based only on
                  transaction size. Itemization is omitted if the two summary
                  sources cannot be matched.
                </dd>
              </div>
              <div>
                <dt>Other political committees</dt>
                <dd>
                  A reporting category that includes PACs and other political
                  committees. It is broader than corporations or industries and
                  does not include independent spending in this funding mix.
                </dd>
              </div>
              <div>
                <dt>Cash and debt</dt>
                <dd>
                  Cash on hand at the end of the filing’s reporting period and
                  debts owed by the campaign. These are campaign figures, not
                  the candidate’s personal finances.
                </dd>
              </div>
              <div>
                <dt>Authorized committee transfers</dt>
                <dd>
                  The FEC warns that summing receipts or disbursements across a
                  candidate’s authorized committees may double-count transfers.
                  We show the reported figures and list transfers separately,
                  without silently adjusting official amounts.
                </dd>
              </div>
              <div>
                <dt>Zeros and negative amounts</dt>
                <dd>
                  Zero means zero in the source summary, not proof that no
                  activity occurred. A missing reporting date is shown as “Not
                  reported.” Negative values may reflect refunds or adjustments;
                  they are preserved.
                </dd>
              </div>
            </dl>
          </section>
          <section id="records">
            <span className="eyebrow">04 / COMMITTEE RECORDS</span>
            <h2>A paper trail, not a donor leaderboard.</h2>
            <p>
              Committee records come from the FEC’s committee-to-candidate bulk
              files. We retain transaction types 24K (contributions) and 24Z
              (in-kind contributions), require the recipient’s committee
              registry designation to be principal or authorized, and require
              its candidate ID to match the transaction’s candidate ID.
            </p>
            <p>
              We restrict transaction dates to the selected cycle, resolve
              reporting committee names from the FEC committee registry, and
              remove only exact duplicate source rows (excluding the database
              import identifier). Memo entries, amended filings, and signed
              adjustments remain visible.
            </p>
            <p>
              For each candidate, we select the latest matching record from each
              of up to 12 reporting committees, ordered by transaction date,
              then filing number and source row ID. Amounts are single records.
              They are neither cumulative donor totals nor an exhaustive,
              amendment-resolved ledger. The “Filing” link opens the relevant
              FEC filing search.
            </p>
            <p>
              These are contributor-side reports. They may differ from amounts
              reported by the receiving campaign. They exclude independent
              expenditures and should not be added to the financial summary.
            </p>
          </section>
          <section id="company-graph">
            <span className="eyebrow">05 / COMPANY CONNECTIONS & RACES</span>
            <h2>Show the relationship, not an assumption.</h2>
            <p>
              Current Races uses the FEC candidate master file: election year
              must equal the chosen election cycle, the office must be House or
              Senate, and statutory candidate status must be C. This is a
              registry of filings, not a certified ballot, nominee list, or
              confirmation a campaign remains active. Senate groups can combine
              separate contests in one state; missing House districts cannot be
              grouped.
            </p>
            <p>
              Each funding map follows one FEC candidate ID across cycles. It
              does not merge people by name. Candidates without a financial
              summary are shown as unavailable, never as zero.
            </p>
            <p>
              Solid lines show complete candidate-reported contribution
              categories. The line width is proportional to its share of total
              contributions when every category is nonnegative. Individual
              contributions are compared with all other-political-committee
              contributions, not an inferred total for companies. Signed
              adjustments remain numeric and are not represented as positive
              proportions.
            </p>
            <p>
              Dotted lines show single committee-reported transaction examples,
              not aggregate donor totals. We select the latest record per
              committee from up to eight corporate connected committees, then
              show up to six on the map. A latest nonpositive or explicitly
              voided record is omitted without falling back to an earlier
              positive record. The official committee registry must report
              organization type C and a connected organization. Brand names and
              local logo assets are matched by committee ID; other organizations
              use text and a lettermark.
            </p>
            <p>
              A company-connected PAC is a separate fund. Its contribution is
              not a corporate treasury contribution to a candidate, and an
              employee’s personal donation is not attributed to the employer.
              Brand visuals identify the registered affiliation and do not imply
              endorsement of this site.{" "}
              <a href="https://www.fec.gov/help-candidates-and-committees/registering-ssf/understanding-ssf-and-its-connected-organization/">
                FEC explanation of connected organizations ↗
              </a>
            </p>
          </section>
          <section id="outside">
            <span className="eyebrow">06 / OUTSIDE SPENDING & DARK MONEY</span>
            <h2>Some funding trails stop before the original donor.</h2>
            <p>
              Outside-spending examples use the same FEC committee-to-candidate
              bulk file, with types 24E (support) and 24A (oppose). The filer
              committee is the spender, and the candidate ID identifies the
              target, not a recipient of campaign funds. We keep the latest
              dated example per spender and support/oppose position, bounded to
              eight records; the race page shows up to six, excluding latest
              nonpositive or explicitly voided records without falling back to
              older positive records. Date filters, exact-duplicate removal,
              memo flags, and amendments follow the same approach as committee
              examples.
            </p>
            <p>
              These records are not summed. They are not complete spending
              totals or an amendment-resolved ledger. Support and opposition
              remain separate; outside spending is never added to campaign
              contributions.
            </p>
            <p>
              “Dark money” generally concerns spending whose original funders
              are not disclosed or readily identifiable. We show original-donor
              visibility as not determined. A Super PAC, nonprofit, or missing
              donor match alone is not enough to label funding dark. These
              snapshots do not trace every upstream contribution, nonprofit
              transfer, electioneering communication, or beneficial owner, so we
              do not publish a dark-money dollar estimate.
            </p>
            <p>
              Some nonprofit contributor identities are not part of public
              tax-return disclosure.{" "}
              <a href="https://www.irs.gov/charities-non-profits/public-disclosure-and-availability-of-exempt-organizations-returns-and-applications-contributors-identities-not-subject-to-disclosure">
                IRS disclosure explanation ↗
              </a>{" "}
              Outside-spending source records and dated original filings remain
              available through the links in each race.
            </p>
          </section>
          <section id="limits">
            <span className="eyebrow">07 / LIMITS & CORRECTIONS</span>
            <h2>Keep the original record in view.</h2>
            <p>
              Campaigns file on different schedules, reports can be amended, and
              classification errors can occur. Comparing two candidates does not
              make their coverage dates identical. The product does not estimate
              corruption, policy influence, personal wealth, or the completeness
              of a donor’s giving.
            </p>
            <p>
              If a number looks unexpected, check the reporting date and the
              linked FEC filing. Source records remain authoritative. To report
              an application issue,{" "}
              <a
                href="https://github.com/ali-zargari/whopaidwho/issues"
                target="_blank"
                rel="noreferrer"
              >
                open an issue in the project repository ↗
              </a>
              .
            </p>
            <div className="source-links">
              <a href="https://www.fec.gov/campaign-finance-data/all-candidates-file-description/">
                FEC all-candidates dictionary ↗
              </a>
              <a href="https://www.fec.gov/campaign-finance-data/candidate-summary-file-description/">
                FEC candidate-summary dictionary ↗
              </a>
              <a href="https://www.fec.gov/campaign-finance-data/contributions-committees-candidates-file-description/">
                FEC committee record dictionary ↗
              </a>
              <a href="https://www.fec.gov/campaign-finance-data/transaction-type-code-descriptions/">
                FEC transaction types ↗
              </a>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
