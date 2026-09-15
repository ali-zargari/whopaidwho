import { candidateEnforcement, enforcementCoverage } from "./enforcement";

export const CASE_STATUSES = {
  settlement: {
    label: "Civil settlement",
    tone: "finding",
    definition:
      "A civil matter resolved by agreement. Read the record for admissions, terms, and which respondent agreed.",
  },
  finding: {
    label: "Official finding",
    tone: "finding",
    definition:
      "An authority reached the finding described in the record. Its scope and evidentiary standard matter.",
  },
  conviction: {
    label: "Criminal conviction",
    tone: "finding",
    definition:
      "A guilty plea or verdict. Sentencing, appeals, and later orders are described separately.",
  },
  charged: {
    label: "Criminal charges",
    tone: "pending",
    definition:
      "Prosecutors filed charges. The accused is presumed innocent unless and until proven guilty.",
  },
  investigation: {
    label: "Investigation announced",
    tone: "pending",
    definition:
      "An authority publicly announced an investigation. This establishes a process, not that the alleged conduct occurred.",
  },
  allegation: {
    label: "Filed allegation",
    tone: "pending",
    definition:
      "A complaint or other attributable allegation. Filing a complaint does not establish an official investigation or a violation.",
  },
  dismissed: {
    label: "Dismissed",
    tone: "closed",
    definition:
      "The authority closed or dismissed the allegations described. The specific grounds, rather than the label alone, explain the outcome.",
  },
} as const;
export type CaseStatus = keyof typeof CASE_STATUSES;
export type AccountabilityCase = {
  id: string;
  candidateId: string;
  candidateName: string;
  authority: string;
  caseNumber: string;
  title: string;
  status: CaseStatus;
  eventDate: string;
  conductPeriod: string;
  respondent: string;
  conduct: string;
  outcome: string;
  context: string;
  penalty?: number;
  penaltyLabel?: string;
  reviewedAt: string;
  sources: { label: string; url: string }[];
};

// Curated public records, independently matched to exact FEC candidate IDs.
// A record here is a partial case review, never a completed background check.
export const accountabilityCases: AccountabilityCase[] = [
  {
    id: "fec-7001-cruz-loans",
    candidateId: "S2TX00312",
    candidateName: "Ted Cruz",
    authority: "Federal Election Commission",
    caseNumber: "MURs 7001, 7002, 7003, 7009 & 7455",
    title: "Campaign misreported the source of bank-financed loans",
    status: "settlement",
    eventDate: "2019-02-20",
    conductPeriod: "2012 Senate campaign",
    respondent: "Ted Cruz for Senate and Bradley S. Knippa, as treasurer",
    conduct:
      "The campaign reported $1,064,000 in loans as Cruz’s personal funds, omitting the required disclosure that Goldman Sachs and Citibank were the underlying lenders.",
    outcome:
      "The campaign and treasurer agreed to a $35,000 civil penalty and to correct the reports. The FEC accepted the agreement and closed the consolidated matters.",
    context:
      "This was a reporting violation by the campaign and treasurer. The FEC separately found no reason to believe Cruz personally violated the reporting provisions. The campaign described the omission as inadvertent.",
    penalty: 35000,
    penaltyLabel: "Civil penalty agreed by campaign and treasurer",
    reviewedAt: "2026-09-15",
    sources: [
      {
        label: "FEC case and respondent dispositions",
        url: "https://www.fec.gov/data/legal/matter-under-review/7001/",
      },
      {
        label: "Executed agreement and closing letter",
        url: "https://www.fec.gov/files/legal/murs/7001/19044460930.pdf",
      },
      {
        label: "Commission vote, February 20, 2019",
        url: "https://www.fec.gov/files/legal/murs/7001/19044460928.pdf",
      },
    ],
  },
  {
    id: "fec-8238-cruz-podcast",
    candidateId: "S2TX00312",
    candidateName: "Ted Cruz",
    authority: "Federal Election Commission",
    caseNumber: "MUR 8238",
    title: "Podcast-revenue complaint was dismissed",
    status: "dismissed",
    eventDate: "2025-01-14",
    conductPeriod: "2023–2024 payments; complaint filed April 2024",
    respondent: "Ted Cruz; Truth and Courage PAC; Kris Ozanus, as treasurer",
    conduct:
      "Campaign Legal Center and End Citizens United alleged that Cruz unlawfully directed iHeart-related podcast revenue to Truth and Courage PAC and that the PAC misreported the payments.",
    outcome:
      "The FEC voted 5–1 to dismiss both allegations and close the file. This matter did not result in a violation finding or civil penalty.",
    context:
      "The adopted analysis said the record did not appear to show Cruz solicited or directed the payments and treated them as commercial payments. This dismissal must accompany any account of the complaint.",
    reviewedAt: "2026-09-15",
    sources: [
      {
        label: "FEC case and disposition",
        url: "https://www.fec.gov/data/legal/matter-under-review/8238/",
      },
      {
        label: "Commission dismissal vote",
        url: "https://www.fec.gov/files/legal/murs/8238/8238_08.pdf",
      },
      {
        label: "General Counsel report and analysis",
        url: "https://www.fec.gov/files/legal/murs/8238/8238_07.pdf",
      },
    ],
  },
  {
    id: "fec-8030-crenshaw-contributions",
    candidateId: "H8TX02166",
    candidateName: "Dan Crenshaw",
    authority: "Federal Election Commission",
    caseNumber: "MUR 8030",
    title: "Campaign accepted excessive and prohibited contributions",
    status: "settlement",
    eventDate: "2022-11-02",
    conductPeriod: "2020 election cycle",
    respondent:
      "Dan Crenshaw for Congress and Paul Kilgore, in his official capacity as treasurer",
    conduct:
      "The agreement describes $207,360.20 in excessive contributions and $16,100 in apparent prohibited corporate and LLC contributions accepted by the campaign.",
    outcome:
      "The FEC accepted a conciliation agreement requiring a $42,000 civil penalty, cessation of the violations, and compliance training for the treasurer. The file was closed.",
    context:
      "The respondent was the campaign and its treasurer, not Crenshaw personally. The agreement records refunds and redesignations, including later corrections. This was a civil settlement before a probable-cause finding, not a criminal conviction.",
    penalty: 42000,
    penaltyLabel: "Civil penalty agreed by campaign and treasurer",
    reviewedAt: "2026-09-15",
    sources: [
      {
        label: "FEC case and dispositions",
        url: "https://www.fec.gov/data/legal/matter-under-review/8030/",
      },
      {
        label: "Executed agreement and closing letter",
        url: "https://www.fec.gov/files/legal/murs/8030/8030_11.pdf",
      },
    ],
  },
  {
    id: "doj-santos-fraud",
    candidateId: "H0NY03083",
    candidateName: "George Santos",
    authority: "U.S. District Court / Department of Justice",
    caseNumber: "2:23-cr-00197",
    title: "Fraud conviction; entire sentence later commuted",
    status: "conviction",
    eventDate: "2025-10-17",
    conductPeriod: "2022 campaign; guilty plea August 2024",
    respondent: "George Anthony Devolder Santos, personally",
    conduct:
      "Santos pleaded guilty to wire fraud and aggravated identity theft. DOJ described admissions involving false campaign-finance reports and charging donors’ credit cards without authorization.",
    outcome:
      "Sentenced to 87 months in April 2025, Santos received a presidential commutation of his entire sentence to time served on October 17, 2025. The warrant specifies no further fines, restitution, probation, supervised release, or other conditions.",
    context:
      "The later commutation changes the punishment; it does not erase the guilty plea or conviction. The original prison term and monetary obligations must not be presented as still outstanding under that sentence.",
    reviewedAt: "2026-09-15",
    sources: [
      {
        label: "DOJ guilty plea and admitted conduct",
        url: "https://www.justice.gov/usao-edny/pr/former-congressman-george-santos-pleads-guilty-wire-fraud-and-aggravated-identity",
      },
      {
        label: "Original sentencing announcement",
        url: "https://www.justice.gov/usao-edny/pr/ex-congressman-george-santos-sentenced-87-months-prison-wire-fraud-and-aggravated",
      },
      {
        label: "Signed October 17, 2025 commutation",
        url: "https://www.justice.gov/pardon/media/1416476/dl?inline",
      },
    ],
  },
  {
    id: "house-119-219-ocasio-cortez-gifts",
    candidateId: "H8NY15148",
    candidateName: "Alexandria Ocasio-Cortez",
    authority: "House Committee on Ethics",
    caseNumber: "House Report 119-219",
    title: "Gift-rule finding with conditional corrective payments",
    status: "finding",
    eventDate: "2025-07-25",
    conductPeriod: "2021 Met Gala",
    respondent: "Alexandria Ocasio-Cortez, personally",
    conduct:
      "The Committee found she did not fully comply with the Gift Rule: her then-partner’s free admission was impermissible and some goods were not paid for at fair-market value.",
    outcome:
      "The report required an additional $2,733.28 payment to Brother Vellies and a $250 donation to the Costume Institute. It said no sanction was merited if these payments were made, with closure upon confirmation.",
    context:
      "The Committee found no evidence she intentionally underpaid and credited her efforts to comply and reliance on counsel. The sources reviewed do not confirm the required payments or a later closure; corrective payments are not a civil fine.",
    reviewedAt: "2026-09-15",
    sources: [
      {
        label: "Committee report, findings and remedy",
        url: "https://ethics.house.gov/wp-content/uploads/2025/07/Committee-Report-20250725-Rep.-Ocasio-Cortez.pdf",
      },
      {
        label: "Response from counsel",
        url: "https://ethics.house.gov/wp-content/uploads/2025/07/APPENDIX-B-20250725-Rep.-Ocasio-Cortez-Report.pdf",
      },
    ],
  },
  {
    id: "house-mills-investigation",
    candidateId: "H2FL07156",
    candidateName: "Cory Mills",
    authority: "House Committee on Ethics",
    caseNumber: "Investigative subcommittee established November 2025",
    title: "Investigation into disclosure, campaign finance and other conduct",
    status: "investigation",
    eventDate: "2026-05-11",
    conductPeriod: "Includes 2022 and 2024 campaigns and 2025 conduct",
    respondent: "Cory Mills, personally",
    conduct:
      "The Committee authorized review of alleged disclosure failures, campaign-finance violations, improper gifts and special favors, sexual misconduct or dating violence, and misuse of congressional resources or status.",
    outcome:
      "In the latest substantive public update located, dated May 11, 2026, the investigative subcommittee reported more than 20 subpoenas and continuing evidence collection. It had not published final findings.",
    context:
      "Establishing the investigation is not a finding that a violation occurred. The May update notes police did not charge Mills over a February 2025 assault allegation; it also explains that this decision does not resolve the Committee’s review.",
    reviewedAt: "2026-09-15",
    sources: [
      {
        label: "Original investigation scope, November 2025",
        url: "https://ethics.house.gov/wp-content/uploads/2025/11/Press-Release-Rep.-Mills-11.19.25.pdf",
      },
      {
        label: "Investigative subcommittee update, May 2026",
        url: "https://ethics.house.gov/press-releases/statement-of-the-chairman-and-ranking-member-of-the-committee-on-ethics-regarding-representative-cory-mills-4/",
      },
    ],
  },
];

export function candidateCases(candidateId: string) {
  return accountabilityCases
    .filter((c) => c.candidateId === candidateId)
    .sort(
      (a, b) =>
        b.eventDate.localeCompare(a.eventDate) || a.id.localeCompare(b.id),
    );
}
export function accountabilitySummary(candidateId: string) {
  const cases = candidateCases(candidateId);
  const fec = candidateEnforcement(candidateId);
  const coverage = enforcementCoverage(candidateId);
  const statuses = [...new Set(cases.map((c) => c.status))];
  const groups = fec.flatMap((c) =>
    c.dispositions.filter((d) => d.matchedCandidateIds.includes(candidateId)),
  );
  const hasPenalty = groups.some(
    (g) => Number((g.penalty || "").replace(/[^\d.]/g, "")) > 0,
  );
  return {
    label: fec.length
      ? `${fec.length} linked FEC campaign case ${fec.length === 1 ? "number" : "numbers"}`
      : coverage === "not-indexed"
        ? "Not included in this FEC index"
        : coverage === "names-unavailable"
          ? "FEC committee names unavailable"
          : "No FEC committee-title match",
    tone: "mixed",
    count: fec.length,
    detail: [
      hasPenalty
        ? "Penalty listed in source; read all outcomes"
        : fec.length
          ? "Read respondent-level decisions"
          : "Limited coverage; not a clearance",
      statuses.length
        ? `Reviewed context: ${statuses.map((s) => CASE_STATUSES[s].label).join(" · ")}`
        : "Broader investigations: not reviewed",
    ].join(". "),
  };
}
export function filterCases(query: string, status: string) {
  const terms = query
    .trim()
    .toLowerCase()
    .slice(0, 100)
    .split(/\s+/)
    .filter(Boolean);
  return accountabilityCases
    .filter(
      (c) =>
        (!status || c.status === status) &&
        terms.every((term) =>
          `${c.candidateId} ${c.candidateName} ${c.title} ${c.caseNumber} ${c.respondent} ${c.conductPeriod} ${c.conduct} ${c.outcome} ${c.context} ${c.authority}`
            .toLowerCase()
            .includes(term),
        ),
    )
    .sort(
      (a, b) =>
        b.eventDate.localeCompare(a.eventDate) || a.id.localeCompare(b.id),
    );
}
