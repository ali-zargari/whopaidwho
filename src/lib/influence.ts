import { readFile } from "node:fs/promises";
import path from "node:path";
import { CYCLES } from "./data";

export type OutsideSpender = {
  id: string;
  name: string;
  support: number;
  oppose: number;
  supportCount: number;
  opposeCount: number;
};
export type OutsideCandidate = {
  status: "reported" | "no-reported-spending";
  support: number;
  oppose: number;
  spenders: OutsideSpender[];
};
export type OutsideSnapshot = {
  schemaVersion: number;
  cycle: number;
  downloadedAt: string;
  sources: Record<string, unknown>[];
  audit: Record<string, unknown>;
  coverage: {
    status: string;
    nonCommitteeForm5Included: boolean;
    rapidNoticesIncluded: boolean;
  };
  candidates: Partial<Record<string, OutsideCandidate>>;
};
export type AffiliationRow = {
  name: string;
  amount: number;
  positiveAmount: number;
  negativeAmount: number;
  count: number;
};
export type AffiliationCandidate = {
  status: "available" | "no-matched-records" | "no-committee-link";
  committees: string[];
  amount: number;
  positiveAmount: number;
  negativeAmount: number;
  count: number;
  employers: AffiliationRow[];
  occupations: AffiliationRow[];
  otherEmployerAmount: number;
  otherOccupationAmount: number;
  missingEmployerAmount: number;
  missingOccupationAmount: number;
  dateFrom: string | null;
  dateThrough: string | null;
};
export type AffiliationSnapshot = {
  cycle: number;
  downloadedAt: string;
  sources: { url: string; lastModified?: string; member?: string }[];
  candidates: Record<string, AffiliationCandidate>;
};
export type FundingDonor = {
  id: string | null;
  name: string;
  amount: number;
  amountLabel: string;
  receiptCount: number;
  kind: string;
  sourceUrl: string;
  disclosure: "nonprofit-source" | "fec-committee" | "organization-reported";
  classificationProofURLs: string[];
  nonprofit: {
    ein: string;
    name: string;
    subsection: string | number;
    matchMethod: string;
  } | null;
  originalDonorVisibility: "not-determined";
  records: {
    amount: number;
    date: string | null;
    lineLabel: string;
    sourceUrl: string;
    subId: string;
  }[];
};
export type FundingCommittee = {
  status:
    | "threshold-coverage"
    | "partial-coverage"
    | "no-qualifying-receipts"
    | "unavailable";
  sourceUrl: string;
  donors: FundingDonor[];
};
export type FundingLinksSnapshot = {
  schemaVersion: number;
  cycle: number;
  downloadedAt: string;
  sources: Record<string, unknown>[];
  irsCoverage: Record<string, unknown>;
  coverage: {
    status: "complete-query" | "partial-query";
    minimumReceiptAmount: number;
    importedRecordCount: number;
    sourceRecordCount: number | null;
    description: string;
  };
  committees: Record<string, FundingCommittee>;
};

const cache = new Map<string, Promise<unknown>>();
async function readSnapshot<T>(kind: string, cycle: number): Promise<T> {
  if (!CYCLES.includes(cycle))
    throw new RangeError("Unsupported reporting cycle");
  const key = `${kind}-${cycle}`;
  if (!cache.has(key)) {
    cache.set(
      key,
      readFile(
        path.join(process.cwd(), "src/data/influence", `${key}.json`),
        "utf8",
      )
        .then((text) => {
          const data = JSON.parse(text);
          if (
            data.cycle !== cycle ||
            !data.downloadedAt ||
            !(data.candidates || data.committees)
          ) {
            throw new Error(`Invalid ${kind} snapshot`);
          }
          return data;
        })
        .catch((error) => {
          cache.delete(key);
          throw error;
        }),
    );
  }
  return cache.get(key)! as Promise<T>;
}
export const outsideSnapshot = (cycle: number) =>
  readSnapshot<OutsideSnapshot>("outside", cycle);
export const affiliationSnapshot = (cycle: number) =>
  readSnapshot<AffiliationSnapshot>("affiliations", cycle);
export const fundingLinksSnapshot = (cycle: number) =>
  readSnapshot<FundingLinksSnapshot>("funding-links", cycle);
export function outsideSourceUrl(
  candidateId: string,
  cycle: number,
  committeeId?: string,
) {
  const params = new URLSearchParams({
    data_type: "processed",
    candidate_id: candidateId,
    cycle: String(cycle),
    is_notice: "false",
    most_recent: "true",
  });
  if (committeeId) params.set("committee_id", committeeId);
  return `https://www.fec.gov/data/independent-expenditures/?${params}`;
}
export function affiliationSourceUrl(
  committeeIds: string[],
  cycle: number,
  kind?: "employer" | "occupation",
  value?: string,
) {
  const params = new URLSearchParams({
    data_type: "processed",
    two_year_transaction_period: String(cycle),
  });
  committeeIds.forEach((id) => params.append("committee_id", id));
  if (kind && value) params.set(`contributor_${kind}`, value);
  return `https://www.fec.gov/data/receipts/individual-contributions/?${params}`;
}
export async function candidateInfluence(id: string, cycle: number) {
  const [outside, affiliations, links] = await Promise.all([
    outsideSnapshot(cycle),
    affiliationSnapshot(cycle),
    fundingLinksSnapshot(cycle),
  ]);
  return {
    candidateId: id,
    cycle,
    outside: {
      ...(outside.candidates[id] || {
        status: "not-indexed" as const,
        support: null,
        oppose: null,
        spenders: [],
      }),
      downloadedAt: outside.downloadedAt,
      coverage: outside.coverage,
      sources: outside.sources,
      sourceAudit: {
        scope:
          "All federal source rows, not this candidate or only congressional races",
        ...outside.audit,
      },
      sourceUrl: outsideSourceUrl(id, cycle),
    },
    affiliations: {
      record: affiliations.candidates[id] || null,
      downloadedAt: affiliations.downloadedAt,
      sources: affiliations.sources,
      sourceLastModified:
        affiliations.sources.find((s) => s.member === "itcont.txt")
          ?.lastModified || null,
    },
    fundingLinks: {
      downloadedAt: links.downloadedAt,
      coverage: links.coverage,
      sources: links.sources,
      irsCoverage: links.irsCoverage,
      committees: Object.fromEntries(
        (outside.candidates[id]?.spenders || []).map((s) => [
          s.id,
          links.committees[s.id] || null,
        ]),
      ),
    },
  };
}
export type CandidateInfluence = Awaited<ReturnType<typeof candidateInfluence>>;
