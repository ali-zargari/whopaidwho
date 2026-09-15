import { readFile } from "node:fs/promises";
import path from "node:path";
import { CYCLES } from "./data";
export type CommitteeRecord = {
  id: string;
  committeeId: string;
  name: string;
  recipientId: string;
  connectedOrganization: string | null;
  organizationType: string | null;
  amount: number;
  date: string;
  type: string;
  memo: string | null;
  isMemo: boolean;
  amendment: string;
  fileNumber: string;
};
export type OutsideRecord = {
  id: string;
  committeeId: string;
  name: string;
  amount: number;
  date: string;
  stance: "support" | "oppose";
  committeeType: string | null;
  type: string;
  memo: string | null;
  isMemo: boolean;
  amendment: string;
  fileNumber: string;
};
type RecordsSnapshot = {
  cycle: number;
  downloadedAt: string;
  source: string;
  committeeSource: string;
  candidates: Record<
    string,
    {
      records: CommitteeRecord[];
      corporateRecords: CommitteeRecord[];
      outsideRecords: OutsideRecord[];
      committeeCount: number;
    }
  >;
};
const cache = new Map<number, Promise<RecordsSnapshot>>();
export async function committeeRecords(id: string, cycle: number) {
  if (!CYCLES.includes(cycle))
    throw new RangeError("Unsupported reporting cycle");
  const safeCycle = cycle;
  if (!cache.has(safeCycle))
    cache.set(
      safeCycle,
      readFile(
        path.join(
          process.cwd(),
          "src/data/fec",
          `committee-records-${safeCycle}.json`,
        ),
        "utf8",
      )
        .then((text) => JSON.parse(text) as RecordsSnapshot)
        .catch((error) => {
          cache.delete(safeCycle);
          throw error;
        }),
    );
  const data = await cache.get(safeCycle)!;
  return {
    ...(data.candidates[id] || {
      records: [],
      corporateRecords: [],
      outsideRecords: [],
      committeeCount: 0,
    }),
    cycle: data.cycle,
    source: data.source,
    committeeSource: data.committeeSource,
    downloadedAt: data.downloadedAt,
  };
}
