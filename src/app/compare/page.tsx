import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, ArrowUpRight, Scale, X } from "lucide-react";
import { getCandidate, parseFilters, toParams, CYCLES } from "@/lib/data";
import {
  coverage,
  date,
  money,
  partyClass,
  partyName,
  initials,
  contributionTotal,
  officeLabel,
  STATES,
} from "@/lib/format";
import CycleSwitcher from "@/components/CycleSwitcher";
import AccountabilityBadge from "@/components/AccountabilityBadge";
import { accountabilitySummary } from "@/lib/accountability";
import ComparePicker from "@/components/ComparePicker";
import { outsideSnapshot } from "@/lib/influence";
export const metadata: Metadata = { title: "Compare campaign funding" };
export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = toParams(await searchParams);
  const { cycle } = parseFilters(params);
  const requested = [
    ...new Set((params.get("ids") || "").split(",").filter(Boolean)),
  ].slice(0, 3);
  const candidates = requested
    .map((id) => getCandidate(id, cycle))
    .filter((c) => c !== undefined);
  const ids = candidates.map((c) => c.id);
  const outside = await outsideSnapshot(cycle);
  const metrics: [string, (c: (typeof candidates)[number]) => string][] = [
    ["Reported receipts", (c) => money(c.receipts)],
    ["Reported spending", (c) => money(c.disbursements)],
    ["Cash on hand", (c) => money(c.cash)],
    ["Debts owed", (c) => money(c.debt)],
    ["Total contributions", (c) => money(contributionTotal(c))],
    ["Individuals", (c) => money(c.individuals)],
    ["Other political committees", (c) => money(c.committees)],
    ["Candidate contributions", (c) => money(c.selfContributions)],
    ["Party contributions", (c) => money(c.partyContributions)],
    ["Candidate loans", (c) => money(c.candidateLoans)],
    ["Transfers from authorized committees", (c) => money(c.transfersIn)],
    ["Reporting coverage end", (c) => coverage(c)],
    [
      "Outside spending supporting candidate",
      (c) => {
        const record = outside.candidates[c.id];
        return record
          ? record.status === "no-reported-spending"
            ? "No processed match"
            : money(record.support)
          : "Not indexed";
      },
    ],
    [
      "Outside spending opposing candidate",
      (c) => {
        const record = outside.candidates[c.id];
        return record
          ? record.status === "no-reported-spending"
            ? "No processed match"
            : money(record.oppose)
          : "Not indexed";
      },
    ],
    ["Outside spending snapshot retrieved", () => date(outside.downloadedAt)],
  ];
  return (
    <main id="main" className="page-shell compare-page">
      <Link href={`/?cycle=${cycle}`} className="back-link">
        <ArrowLeft size={15} />
        Explore candidates
      </Link>
      <section className="compare-intro">
        <span className="eyebrow">
          SIDE BY SIDE · {cycle - 1}–{cycle}
        </span>
        <h1>Same cycle. Different funding.</h1>
        <p>
          Compare up to three campaigns. Reporting dates can differ, so read the
          amounts in context.
        </p>
      </section>
      <CycleSwitcher cycle={cycle} cycles={CYCLES} ids={ids} />
      {requested.length !== candidates.length && (
        <p className="profile-notice">
          Some requested candidates were not found in this cycle. Choose
          replacements below.
        </p>
      )}
      {candidates.length > 0 ? (
        <div className="comparison-table-wrap">
          <table className="comparison-table">
            <caption className="sr-only">
              Campaign financial comparison, {cycle - 1}–{cycle}
            </caption>
            <thead>
              <tr>
                <th scope="col">
                  <Scale size={27} />
                  <span className="eyebrow">FOLLOW THE DIFFERENCES</span>
                  <span className="comparison-cycle">
                    {cycle - 1}–{cycle}
                  </span>
                </th>
                {candidates.map((c) => (
                  <th key={c.id} scope="col">
                    <div className="comparison-person">
                      <div className={`avatar ${partyClass(c.party)}`}>
                        {initials(c.name)}
                      </div>
                      <Link
                        className="icon-button"
                        aria-label={`Remove ${c.name}`}
                        href={`/compare?cycle=${cycle}&ids=${ids.filter((id) => id !== c.id).join(",")}`}
                      >
                        <X size={16} />
                      </Link>
                    </div>
                    <Link
                      href={`/candidate/${c.id}?cycle=${cycle}`}
                      className="comparison-name"
                    >
                      {c.name}
                      <ArrowUpRight size={15} />
                    </Link>
                    <p>
                      {STATES[c.state] || c.state} · {officeLabel(c)}
                    </p>
                    <span className={`party-badge ${partyClass(c.party)}`}>
                      {partyName(c.party)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Accountability · source coverage</th>
                {candidates.map((c) => (
                  <td key={c.id}>
                    <AccountabilityBadge
                      candidateId={c.id}
                      cycle={cycle}
                      summary={accountabilitySummary(c.id)}
                    />
                  </td>
                ))}
              </tr>
              {metrics.map(([label, format]) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  {candidates.map((c) => (
                    <td key={c.id}>{format(c)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="compare-empty">
          <Scale size={38} />
          <h2>Put the numbers next to each other.</h2>
          <p>
            Start with a candidate below, or select Compare on any card in the
            explorer.
          </p>
        </div>
      )}
      {candidates.length < 3 && (
        <ComparePicker key={ids.join(",")} cycle={cycle} ids={ids} />
      )}
      <div className="callout compare-note">
        <p>
          Contributions exclude loans and transfers. Reported receipts and
          spending can include transfers between authorized committees. These
          are campaign finances, not personal wealth or a measure of political
          influence. <Link href="/methodology">Read our methodology ↗</Link>{" "}
          Outside spending is paid by independent groups and is separate from
          campaign receipts. Totals cover processed periodic filings, excluding
          recent 24/48-hour notices.
        </p>
      </div>
    </main>
  );
}
