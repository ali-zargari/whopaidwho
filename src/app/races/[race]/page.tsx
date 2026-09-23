import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { CYCLES, parseFilters, toParams, getCandidate } from "@/lib/data";
import { getRaces } from "@/lib/races";
import { committeeRecords } from "@/lib/records";
import {
  coverage,
  money,
  contributionTotal,
  partyClass,
  partyName,
} from "@/lib/format";
import RaceControls from "@/components/RaceControls";
import AccountabilityPanel from "@/components/AccountabilityPanel";
import FundingMap from "@/components/FundingMap";
import OutsideSpending from "@/components/OutsideSpending";
import FundingTransparency from "@/components/FundingTransparency";
import DonorAffiliations from "@/components/DonorAffiliations";
import { candidateInfluence } from "@/lib/influence";
type Props = {
  params: Promise<{ race: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const { race } = await params;
  const { cycle } = parseFilters(toParams(await searchParams));
  const group = getRaces(cycle).find((r) => r.id === race);
  return {
    title: group
      ? `${group.name} · ${cycle} funding map`
      : "Race group not found",
  };
}
export default async function RacePage({ params, searchParams }: Props) {
  const { race: id } = await params;
  const query = toParams(await searchParams);
  const { cycle } = parseFilters(query);
  const race = getRaces(cycle).find((r) => r.id === id);
  if (!race) notFound();
  const fundingCycle = CYCLES.includes(Number(query.get("fundingCycle")))
    ? Number(query.get("fundingCycle"))
    : cycle;
  const registration =
    race.registrations.find((r) => r.id === query.get("candidate")) ||
    race.registrations[0];
  const candidate = getCandidate(registration.id, fundingCycle) || null;
  const [records, influence] = await Promise.all([
    committeeRecords(registration.id, fundingCycle),
    candidateInfluence(registration.id, fundingCycle),
  ]);
  return (
    <main id="main" className="page-shell race-detail">
      <Link href={`/races?cycle=${cycle}`} className="back-link">
        <ArrowLeft size={15} />
        All {cycle} races
      </Link>
      <div className="race-detail-heading">
        <span className="eyebrow">
          {cycle} REGISTERED CANDIDATES · {race.registrations.length} FEC
          RECORDS
        </span>
        <h1>{race.name}</h1>
        <p>
          Compare campaign funding and explore the organizations connected to
          each candidate.
        </p>
      </div>
      <div className="race-candidate-strip">
        {race.registrations.slice(0, 5).map((r) => {
          const c = getCandidate(r.id, cycle);
          return (
            <Link
              key={r.id}
              href={`/races/${id}?cycle=${cycle}&fundingCycle=${fundingCycle}&candidate=${r.id}`}
              className={`race-candidate-chip ${r.id === registration.id ? "active" : ""}`}
            >
              <span className={`party-badge ${partyClass(r.party)}`}>
                {partyName(r.party)}
              </span>
              <strong>{r.name}</strong>
              <span>
                {c
                  ? `${money(contributionTotal(c), true)} contributions`
                  : "Financial summary unavailable"}
              </span>
            </Link>
          );
        })}
      </div>
      <RaceControls
        race={id}
        cycle={cycle}
        fundingCycle={fundingCycle}
        candidate={registration.id}
        registrations={race.registrations}
        cycles={CYCLES}
      />
      <AccountabilityPanel
        candidateId={registration.id}
        name={registration.name}
        cycle={fundingCycle}
      />
      <FundingMap
        key={`${registration.id}-${fundingCycle}`}
        candidate={candidate}
        registration={registration}
        corporateRecords={records.corporateRecords || []}
        cycle={fundingCycle}
      />
      <OutsideSpending
        name={registration.name}
        candidate={candidate}
        data={influence}
      />
      <FundingTransparency data={influence} />
      <DonorAffiliations data={influence} />
      <section className="panel race-roster">
        <div className="panel-title">
          <div>
            <span className="eyebrow">THE REGISTRATION RECORD</span>
            <h2>All candidates in this race group</h2>
          </div>
          <span>{cycle} election registrations</span>
        </div>
        <p className="muted-text">
          Includes primary filings and candidates who may have withdrawn. Senate
          filings can include different contests in the same state. Consult
          state election officials for the certified ballot.
        </p>
        <div className="table-scroll">
          <table className="records-table">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Party</th>
                <th className="number-cell">Contributions in {cycle}</th>
                <th>Reporting coverage</th>
                <th>Explore</th>
              </tr>
            </thead>
            <tbody>
              {race.registrations.map((r) => {
                const c = getCandidate(r.id, cycle);
                return (
                  <tr key={r.id}>
                    <td>
                      {r.name}
                      <span className="record-meta">{r.id}</span>
                    </td>
                    <td>{partyName(r.party)}</td>
                    <td className="number-cell">
                      {c ? money(contributionTotal(c)) : "Not available"}
                    </td>
                    <td>{c ? coverage(c) : "Not available"}</td>
                    <td>
                      <Link
                        className="filing-link"
                        href={`/races/${id}?cycle=${cycle}&candidate=${r.id}`}
                      >
                        Map
                        <ArrowUpRight size={13} />
                      </Link>
                      {c && (
                        <Link
                          className="filing-link"
                          href={`/candidate/${r.id}?cycle=${cycle}`}
                        >
                          Profile
                          <ArrowUpRight size={13} />
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
